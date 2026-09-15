"""
College bulk-import engine.

Responsibilities
----------------
* generate_template()  → openpyxl Workbook (Excel template with dropdowns)
* parse_and_import(file) → dict with full results (imported, failed, failures)

Design principles
-----------------
* Validate ALL rows before touching the database.
* Import valid rows inside a single transaction.atomic() — if the DB write
  fails, nothing is committed.
* Invalid rows are NEVER silently skipped; every failure carries a row number,
  a college name (if parseable), and a list of human-readable error messages.
* Duplicate detection: within-file (case-insensitive) AND against the DB.
* Normalisation: state, college_type, and boolean fields accept common
  variations so a single-case typo doesn't kill a row.
"""

from __future__ import annotations

import io
from datetime import date
from typing import Any

from django.db import transaction
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from .models import College, Department, SeatEntry, FeeEntry, StipendEntry

# ── Reference data ────────────────────────────────────────────────────────────

INDIA_STATES: list[str] = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
]

INDIA_UNION_TERRITORIES: list[str] = [
    "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
    "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
]

ALL_STATES: list[str] = INDIA_STATES + INDIA_UNION_TERRITORIES

# Normalisation maps (lowercase key → canonical value)
VALID_STATES: dict[str, str]       = {s.lower(): s for s in ALL_STATES}
COLLEGE_TYPE_MAP: dict[str, str]   = {
    "govt": "govt", "government": "govt", "gov": "govt", "governmental": "govt",
    "private": "private", "pvt": "private", "priv": "private",
}
BOOL_MAP: dict[str, bool]          = {
    "yes": True, "true": True, "1": True, "y": True,
    "no": False, "false": False, "0": False, "n": False, "": False,
}

REQUIRED_COLUMNS = {
    "name", "location", "state", "college_type",
    "is_ug", "is_pg", "has_mbbs", "has_dental", "has_nursing",
    "intake_seats", "established_year",
}
# fee_entries, stipend_entries, departments, seat_entries are optional —
# their absence is handled gracefully by _parse_* functions returning empty lists.

MAX_FILE_SIZE  = 5 * 1024 * 1024   # 5 MB
MAX_DATA_ROWS  = 500


# ── Entry parsers ─────────────────────────────────────────────────────────────

def _parse_seat_entries(raw: str) -> tuple[list[dict], list[str]]:
    """
    Parse the optional seat_entries cell value into (entries, warnings).

    Accepted format (comma-separated, each item is  Program=Seats  or
    Program/Department=Seats):

        MBBS=150
        MBBS=150,Dental=50
        MBBS=150,PG/Cardiology=20,PG/Neurology=15,PG/Nephrology=10

    Returns
    -------
    entries  : list of valid entry dicts {program, department, seats, display_order}
    warnings : list of human-readable strings describing each skipped item
    """
    return _parse_numeric_entries(raw, value_key="seats", value_label="seats")


def _parse_finance_entries(raw: str, value_label: str = "amount") -> tuple[list[dict], list[str]]:
    """
    Parse fee_entries or stipend_entries cell values into (entries, warnings).

    Accepted format (same as seat_entries but the value is INR amount):

        MBBS=150000
        MBBS=150000,Dental=80000
        MBBS=150000,PG/Cardiology=200000,PG/Neurology=180000

    Returns
    -------
    entries  : list of valid entry dicts {program, department, amount, display_order}
    warnings : list of human-readable strings describing each skipped item
    """
    return _parse_numeric_entries(raw, value_key="amount", value_label=value_label)


def _parse_numeric_entries(
    raw: str,
    value_key: str,
    value_label: str,
) -> tuple[list[dict], list[str]]:
    """
    Generic parser for columns in the form  Program=Value  or  Program/Dept=Value.
    Used by both _parse_seat_entries and _parse_finance_entries.
    """
    entries:  list[dict] = []
    warnings: list[str]  = []

    if not raw or not raw.strip():
        return entries, warnings

    for order, item in enumerate(raw.split(",")):
        item = item.strip()
        if not item:
            continue

        if "=" not in item:
            warnings.append(
                f"Skipped '{item}': missing '=' separator "
                f"(expected Program={value_label.capitalize()})."
            )
            continue

        prog_dept, value_str = item.rsplit("=", 1)
        prog_dept  = prog_dept.strip()
        value_str  = value_str.strip()

        try:
            value = int(value_str)
            if value < 0:
                raise ValueError
        except ValueError:
            warnings.append(
                f"Skipped '{item}': {value_label} must be a whole number ≥ 0 "
                f"(got '{value_str}')."
            )
            continue

        if "/" in prog_dept:
            program, department = prog_dept.split("/", 1)
            program    = program.strip()
            department = department.strip()
        else:
            program    = prog_dept
            department = ""

        if not program:
            warnings.append(f"Skipped '{item}': program name is empty.")
            continue

        entries.append({
            "program":       program,
            "department":    department,
            value_key:       value,
            "display_order": order,
        })

    return entries, warnings


# ── Template generation ───────────────────────────────────────────────────────

def generate_template() -> bytes:
    """Return the Excel template as raw bytes."""
    wb = Workbook()

    # ── Hidden reference sheet for state dropdown ──
    ref_ws = wb.create_sheet("_states")
    ref_ws.sheet_state = "hidden"
    for i, state in enumerate(ALL_STATES, start=1):
        ref_ws.cell(row=i, column=1, value=state)
    ref_range = f"_states!$A$1:$A${len(ALL_STATES)}"

    # ── Main sheet ──
    ws = wb.active
    ws.title = "Colleges"
    ws.freeze_panes = "A2"   # freeze header row

    columns = [
        ("name",             "College Name *",              30),
        ("location",         "Location (Full Address) *",   48),
        ("state",            "State",                       24),
        ("college_type",     "Type (govt/private) *",       22),
        ("is_ug",            "UG? (yes/no) *",              14),
        ("is_pg",            "PG? (yes/no) *",              14),
        ("has_mbbs",         "MBBS? (yes/no) *",            16),
        ("has_dental",       "Dental? (yes/no) *",          17),
        ("has_nursing",      "Nursing? (yes/no) *",         18),
        ("intake_seats",     "Intake Seats *",              14),
        ("established_year", "Established Year *",          18),
        ("departments",      "Departments (comma-sep)",     28),
        ("seat_entries",     "Seat Entries (optional)",     44),
        ("fee_entries",      "Fee Entries ₹/yr (optional)", 44),
        ("stipend_entries",  "Stipend Entries ₹/mo (optional)", 44),
    ]

    # Header row style
    hdr_fill   = PatternFill("solid", fgColor="D9E1F2")
    hdr_font   = Font(bold=True, color="1F2D4E", size=10)
    hdr_align  = Alignment(horizontal="center", vertical="center", wrap_text=True)
    hdr_border = Border(bottom=Side(style="medium", color="4472C4"))

    for col_idx, (key, label, width) in enumerate(columns, start=1):
        cell = ws.cell(row=1, column=col_idx, value=label)
        cell.fill   = hdr_fill
        cell.font   = hdr_font
        cell.alignment = hdr_align
        cell.border = hdr_border
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    ws.row_dimensions[1].height = 32

    # ── Data-validation dropdowns ──
    START_ROW = 2
    END_ROW   = 501   # covers 500 data rows

    dv_state = DataValidation(type="list", formula1=ref_range, allow_blank=True, showDropDown=False)
    dv_state.sqref = f"C{START_ROW}:C{END_ROW}"
    ws.add_data_validation(dv_state)

    dv_type = DataValidation(type="list", formula1='"govt,private"', allow_blank=False, showDropDown=False)
    dv_type.sqref = f"D{START_ROW}:D{END_ROW}"
    ws.add_data_validation(dv_type)

    for bool_col in ("E", "F", "G", "H", "I"):
        dv_bool = DataValidation(type="list", formula1='"yes,no"', allow_blank=False, showDropDown=False)
        dv_bool.sqref = f"{bool_col}{START_ROW}:{bool_col}{END_ROW}"
        ws.add_data_validation(dv_bool)

    # ── Sample row (light background, normal readable text) ──
    sample_fill  = PatternFill("solid", fgColor="EFF6FF")   # very light blue tint
    sample_font  = Font(color="1E3A5F", size=10, italic=True)
    sample_align = Alignment(vertical="center")

    sample_values = [
        "AIIMS New Delhi",
        "Ansari Nagar East, New Delhi, Delhi 110029",
        "Delhi", "govt",
        "yes", "yes", "yes", "no", "no",
        "100", "1956",
        "Cardiology,Neurology,General Medicine",
        "MBBS=50,PG/Cardiology=20,PG/Neurology=15,PG/General Medicine=15",
        "MBBS=150000,PG/Cardiology=200000,PG/Neurology=180000",
        "PG/Cardiology=75000,PG/Neurology=65000",
    ]
    for col_idx, val in enumerate(sample_values, start=1):
        cell = ws.cell(row=2, column=col_idx, value=val)
        cell.fill      = sample_fill
        cell.font      = sample_font
        cell.alignment = sample_align

    ws.row_dimensions[2].height = 22

    # Instructions tab
    info_ws = wb.create_sheet("Instructions")
    info_ws["A1"] = "Darkdoctor: College Bulk Import Template"
    info_ws["A1"].font = Font(bold=True, size=14)
    info_ws["A3"] = "Rules"
    info_ws["A3"].font = Font(bold=True)
    rules = [
        "• Fields marked * are required.",
        "• location: Enter the FULL street address, not just the city.",
        "  Example: 123 Main Street, Ashok Nagar, Chennai, Tamil Nadu 600083",
        "  This address is shown to users and used for Google Maps navigation.",
        "• state: use the dropdown, must match an Indian state or UT exactly.",
        "• college_type: 'govt' or 'private' only.",
        "• is_ug, is_pg, has_mbbs, has_dental, has_nursing: 'yes' or 'no' only.",
        "• At least one of is_ug / is_pg must be 'yes'.",
        "• At least one of has_mbbs / has_dental / has_nursing must be 'yes'.",
        "• intake_seats: positive whole number.",
        "• established_year: four-digit year between 1800 and current year.",
        "• departments: comma-separated list, e.g.  Cardiology,Neurology",
        "• seat_entries: optional breakdown of seats by program/department.",
        "  Format:  Program=Seats  or  Program/Department=Seats  (comma-separated).",
        "  Examples:",
        "    MBBS=150",
        "    MBBS=150,Dental=50",
        "    MBBS=100,PG/Cardiology=20,PG/Neurology=15,PG/Nephrology=10",
        "  Leave blank to skip, seats can be added later from the college detail page.",
        "• fee_entries: optional annual fee breakdown per program (₹/year, whole rupees).",
        "  Format:  Program=Amount  or  Program/Department=Amount  (comma-separated).",
        "  Examples:",
        "    MBBS=150000",
        "    MBBS=150000,Dental=80000",
        "    MBBS=150000,PG/Cardiology=200000,PG/Neurology=180000",
        "  Leave blank to skip, fees can be added later from the college detail page.",
        "• stipend_entries: optional monthly stipend breakdown per program (₹/month, whole rupees).",
        "  Format:  Program=Amount  or  Program/Department=Amount  (comma-separated).",
        "  Examples:",
        "    PG=50000",
        "    PG/Cardiology=75000,PG/Neurology=65000",
        "  Leave blank to skip, stipends can be added later from the college detail page.",
        "• Do NOT delete or rename any column headers.",
        "• Row 2 is a sample, replace it with real data.",
        f"• Maximum {MAX_DATA_ROWS} data rows per upload.",
    ]
    for i, rule in enumerate(rules, start=4):
        info_ws[f"A{i}"] = rule
    info_ws.column_dimensions["A"].width = 80

    # Serialise to bytes
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


# ── Row parsers ───────────────────────────────────────────────────────────────

def _str(val: Any) -> str:
    return str(val).strip() if val is not None else ""


def _parse_bool(raw: Any) -> bool | None:
    return BOOL_MAP.get(_str(raw).lower())


def _parse_college_type(raw: Any) -> str | None:
    return COLLEGE_TYPE_MAP.get(_str(raw).lower())


def _parse_state(raw: Any) -> str | None:
    """Returns canonical state name, empty string for empty input, None for invalid."""
    s = _str(raw)
    if not s:
        return ""
    return VALID_STATES.get(s.lower())


# ── Main import function ──────────────────────────────────────────────────────

def parse_and_import(file) -> dict:
    """
    Parse the uploaded file and import valid rows.

    Returns
    -------
    {
      "total":    int,
      "imported": int,
      "failed":   int,
      "failures": [
        {"row": int, "name": str, "location": str, "errors": [str, ...]}
      ]
    }
    """

    # ── File-level checks ──────────────────────────────────────────────────
    if file.size > MAX_FILE_SIZE:
        raise ValueError(f"File too large. Maximum allowed size is 5 MB.")

    ext = getattr(file, "name", "").rsplit(".", 1)[-1].lower()
    if ext not in ("xlsx", "xls"):
        raise ValueError("Only Excel files (.xlsx or .xls) are accepted.")

    try:
        wb = load_workbook(file, data_only=True, read_only=True)
    except Exception:
        raise ValueError("Cannot read the file. Ensure it is a valid, unprotected Excel file.")

    ws = wb.active

    # ── Header row ────────────────────────────────────────────────────────
    raw_headers = [_str(c.value).lower() for c in next(ws.iter_rows(min_row=1, max_row=1))]
    col_idx: dict[str, int] = {h: i for i, h in enumerate(raw_headers)}

    missing_cols = REQUIRED_COLUMNS - set(col_idx)
    if missing_cols:
        raise ValueError(
            f"Missing required column(s): {', '.join(sorted(missing_cols))}. "
            "Download the template again and do not rename headers."
        )

    # ── Pre-load existing names for duplicate check (one query) ───────────
    existing_names: set[str] = {
        n.lower() for n in College.objects.values_list("name", flat=True)
    }

    current_year = date.today().year

    results: dict = {
        "total": 0, "imported": 0, "failed": 0,
        "failures": [],
        "seat_entry_warnings":    [],   # row-level warnings for skipped seat entries
        "fee_entry_warnings":     [],   # row-level warnings for skipped fee entries
        "stipend_entry_warnings": [],   # row-level warnings for skipped stipend entries
    }
    valid_rows:     list[dict]       = []
    valid_depts:    list[list[str]]  = []
    valid_seats:    list[list[dict]] = []   # parallel: parsed seat entries per row
    valid_fees:     list[list[dict]] = []   # parallel: parsed fee entries per row
    valid_stipends: list[list[dict]] = []   # parallel: parsed stipend entries per row
    seen_in_file:   set[str]         = set()
    row_num = 1

    # ── Row-by-row validation ──────────────────────────────────────────────
    for row in ws.iter_rows(min_row=2, values_only=True):
        row_num += 1

        # Skip completely empty rows
        if all(v is None or _str(v) == "" for v in row):
            continue

        # Enforce row limit
        if results["total"] >= MAX_DATA_ROWS:
            results["failures"].append({
                "row": row_num,
                "name": "(truncated)",
                "location": "",
                "errors": [f"File exceeds the {MAX_DATA_ROWS}-row limit. Rows beyond this were skipped."],
            })
            results["failed"] += 1
            continue

        results["total"] += 1
        errors: list[str] = []

        def get(field: str) -> str:
            idx = col_idx.get(field)
            return _str(row[idx]) if idx is not None and idx < len(row) else ""

        # ── Name ──
        name = get("name")
        if not name:
            errors.append("College name is required.")

        # ── Location ──
        location = get("location")
        if not location:
            errors.append("Location is required.")

        # ── State ──
        state_raw  = get("state")
        state      = _parse_state(state_raw)
        if state is None:
            errors.append(
                f"'{state_raw}' is not a recognised Indian state or UT. "
                "Use the dropdown in the template."
            )
            state = ""

        # ── College type ──
        type_raw     = get("college_type")
        college_type = _parse_college_type(type_raw)
        if college_type is None:
            errors.append(f"college_type must be 'govt' or 'private' (got '{type_raw}').")

        # ── Booleans ──
        bool_fields: dict[str, bool] = {}
        for bf in ("is_ug", "is_pg", "has_mbbs", "has_dental", "has_nursing"):
            raw = get(bf)
            val = _parse_bool(raw)
            if val is None:
                errors.append(f"'{bf}' must be yes or no (got '{raw}').")
            else:
                bool_fields[bf] = val

        # ── Level: at least one of UG / PG ──
        if "is_ug" in bool_fields and "is_pg" in bool_fields:
            if not bool_fields["is_ug"] and not bool_fields["is_pg"]:
                errors.append("At least one of is_ug / is_pg must be 'yes'.")

        # ── Course: at least one course type ──
        course_keys = ("has_mbbs", "has_dental", "has_nursing")
        if all(k in bool_fields for k in course_keys):
            if not any(bool_fields[k] for k in course_keys):
                errors.append("At least one of has_mbbs / has_dental / has_nursing must be 'yes'.")

        # ── intake_seats ──
        seats_raw = get("intake_seats")
        intake_seats: int | None = None
        try:
            intake_seats = int(float(seats_raw))
            if intake_seats <= 0:
                errors.append("intake_seats must be a positive number.")
        except (ValueError, TypeError):
            errors.append(f"intake_seats must be a whole number (got '{seats_raw}').")

        # ── established_year ──
        year_raw = get("established_year")
        established_year: int | None = None
        try:
            established_year = int(float(year_raw))
            if not (1800 <= established_year <= current_year):
                errors.append(
                    f"established_year must be between 1800 and {current_year} (got '{year_raw}')."
                )
        except (ValueError, TypeError):
            errors.append(f"established_year must be a 4-digit year (got '{year_raw}').")

        # ── Departments (optional, comma-separated) ──
        dept_raw  = get("departments")
        dept_list = [d.strip() for d in dept_raw.split(",") if d.strip()] if dept_raw else []

        # ── Seat entries (optional, see _parse_seat_entries) ──
        seat_raw               = get("seat_entries")
        seat_parsed, seat_warn = _parse_seat_entries(seat_raw)
        for w in seat_warn:
            results["seat_entry_warnings"].append(f"Row {row_num}: {w}")

        # ── Fee entries (optional) ──
        fee_raw               = get("fee_entries")
        fee_parsed, fee_warn  = _parse_finance_entries(fee_raw, value_label="amount (₹/yr)")
        for w in fee_warn:
            results["fee_entry_warnings"].append(f"Row {row_num}: {w}")

        # ── Stipend entries (optional) ──
        stipend_raw                 = get("stipend_entries")
        stipend_parsed, stipend_warn = _parse_finance_entries(stipend_raw, value_label="amount (₹/mo)")
        for w in stipend_warn:
            results["stipend_entry_warnings"].append(f"Row {row_num}: {w}")

        # ── Duplicate within file ──
        name_key = name.lower() if name else ""
        if name_key and name_key in seen_in_file:
            errors.append(
                f"Duplicate in this file: '{name}' appears more than once. "
                "Remove the duplicate row and re-upload."
            )
        elif name_key:
            seen_in_file.add(name_key)

        # ── Duplicate in database ──
        if name and name_key not in seen_in_file - {name_key}:
            if name_key in existing_names:
                errors.append(
                    f"A college named '{name}' already exists in the database. "
                    "Edit the existing record instead."
                )

        # ── Collect or reject ──
        if errors:
            results["failed"] += 1
            results["failures"].append({
                "row":      row_num,
                "name":     name or "(no name)",
                "location": location or "",
                "errors":   errors,
            })
        else:
            valid_rows.append({
                "name":             name,
                "location":         location,
                "state":            state,
                "college_type":     college_type,
                "intake_seats":     intake_seats,
                "established_year": established_year,
                **bool_fields,
            })
            valid_depts.append(dept_list)
            valid_seats.append(seat_parsed)
            valid_fees.append(fee_parsed)
            valid_stipends.append(stipend_parsed)

    wb.close()

    # ── Atomic DB insert for all valid rows ───────────────────────────────
    if valid_rows:
        try:
            with transaction.atomic():
                college_objs = [College(**row) for row in valid_rows]
                created      = College.objects.bulk_create(college_objs)

                dept_objs: list[Department] = []
                for college, depts in zip(created, valid_depts):
                    for dname in depts:
                        dept_objs.append(Department(college=college, name=dname))

                if dept_objs:
                    Department.objects.bulk_create(dept_objs, ignore_conflicts=True)

                # ── Seat entries (optional column) ────────────────────────
                seat_objs: list[SeatEntry] = []
                for college, entries in zip(created, valid_seats):
                    for entry in entries:
                        seat_objs.append(SeatEntry(
                            college=college,
                            program=entry["program"],
                            department=entry["department"],
                            seats=entry["seats"],
                            display_order=entry["display_order"],
                        ))
                if seat_objs:
                    SeatEntry.objects.bulk_create(seat_objs)

                # ── Fee entries (optional column) ─────────────────────────
                fee_objs: list[FeeEntry] = []
                for college, entries in zip(created, valid_fees):
                    for entry in entries:
                        fee_objs.append(FeeEntry(
                            college=college,
                            program=entry["program"],
                            department=entry["department"],
                            amount=entry["amount"],
                            display_order=entry["display_order"],
                        ))
                if fee_objs:
                    FeeEntry.objects.bulk_create(fee_objs)

                # ── Stipend entries (optional column) ─────────────────────
                stipend_objs: list[StipendEntry] = []
                for college, entries in zip(created, valid_stipends):
                    for entry in entries:
                        stipend_objs.append(StipendEntry(
                            college=college,
                            program=entry["program"],
                            department=entry["department"],
                            amount=entry["amount"],
                            display_order=entry["display_order"],
                        ))
                if stipend_objs:
                    StipendEntry.objects.bulk_create(stipend_objs)

            results["imported"] = len(created)
        except Exception as exc:
            raise RuntimeError(
                "Database error during import, no records were saved. "
                f"Detail: {exc}"
            )

    return results
