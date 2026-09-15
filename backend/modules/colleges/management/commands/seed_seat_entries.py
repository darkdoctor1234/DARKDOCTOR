"""
Management command: auto-seed SeatEntry breakdown for existing colleges.

How it works
------------
1. Derives programs from college flags (has_mbbs, has_dental, has_nursing, is_pg).
2. Distributes intake_seats across programs using realistic weights:
       MBBS → 3,  Dental → 1,  Nursing → 1,  PG → 2
3. Classifies each existing Department into its program via keyword matching.
4. Splits that program's seats equally across its departments.
   If a program has no departments → falls back to a program-level entry (dept="").

Result examples
---------------
  College: MBBS only, 150 seats, 8 departments
    MBBS / Anatomy              → 19
    MBBS / Physiology           → 19
    MBBS / Internal Medicine    → 19
    ...

  College: MBBS + PG, 200 seats, MBBS has 7 depts, PG has 3 depts
    MBBS / Anatomy              → 17   (120 seats ÷ 7 depts)
    MBBS / Surgery              → 17
    ...
    PG   / Cardiology           → 27   (80 seats ÷ 3 depts)
    PG   / Neurology            → 27
    PG   / Nephrology           → 26

Safety model
------------
• DRY-RUN by default — nothing is written until you pass --apply.
• Skips colleges that already have seat_entries (safe to re-run).
• --overwrite clears and rebuilds colleges that already have entries.
• All writes happen inside a single atomic transaction.

Usage
-----
  python manage.py seed_seat_entries              # preview (safe)
  python manage.py seed_seat_entries --apply      # write to DB
  python manage.py seed_seat_entries --apply --overwrite   # re-seed all
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from modules.colleges.models import College, SeatEntry


# ── Program weights (realistic Indian medical college proportions) ─────────
WEIGHTS: dict[str, int] = {
    "MBBS":    3,
    "Dental":  1,
    "Nursing": 1,
    "PG":      2,
}

# ── Department → Program keyword maps ────────────────────────────────────────
# Checked in this exact order: Dental → Nursing → PG → MBBS → fallback.
# Each entry is a substring that, if found in the lowercase dept name, triggers
# that program classification.

DENTAL_KW = [
    "oral", "dent", "orthodont", "periodont", "prosthodont",
    "pedodont", "maxillofacial", "endodont", "public health dent",
]

NURSING_KW = [
    "nursing", "midwifery",
]

PG_KW = [
    "cardiology", "neurology", "oncology", "nephrology",
    "gastroenterol", "pulmonol", "endocrinol",
    "haematol", "hematol", "rheumatol", "hepatol",
    "urolog", "neonatol", "electrophysiol", "intervent",
    "plastic surgery", "vascular surgery", "thoracic", "cardiac surgery",
]

MBBS_KW = [
    "anatom", "physiolog", "biochem", "pharmacol", "microbiol",
    "forensic", "community medicine",
    "internal medicine", "general medicine",
    "general surgery", "surgery",
    "paediatric", "pediatric",
    "obstetric", "gynaecol", "gynecol",
    "orthopaedic", "orthopedic",
    "radiol", "anaesthesiol", "anesthesiol",
    "dermatol", "ophthalmol", "psychiatr",
    "patholog",      # catches both Pathology and Oral Pathology (oral check runs first)
    "ent",           # Ear, Nose & Throat
    "ear, nose",
]


# ── Helper: classify one department name → program ───────────────────────────

def _classify_dept(dept_name: str, available: set[str]) -> str:
    """
    Maps a department name to the best-fit program from `available`.
    Falls back to the highest-weight available program if nothing matches.
    """
    n = dept_name.lower()

    if "Dental" in available and any(kw in n for kw in DENTAL_KW):
        return "Dental"

    if "Nursing" in available and any(kw in n for kw in NURSING_KW):
        return "Nursing"

    if "PG" in available and any(kw in n for kw in PG_KW):
        return "PG"

    if "MBBS" in available and any(kw in n for kw in MBBS_KW):
        return "MBBS"

    # Fallback: highest-weight program that exists on this college
    for prog in ["MBBS", "PG", "Dental", "Nursing"]:
        if prog in available:
            return prog

    return list(available)[0]


# ── Helper: derive programs from college flags ────────────────────────────────

def _derive_programs(college: College) -> list[tuple[str, int]]:
    """Returns [(program_name, weight)] in display order (UG first, PG last)."""
    result: list[tuple[str, int]] = []
    if college.is_ug:
        if college.has_mbbs:    result.append(("MBBS",    WEIGHTS["MBBS"]))
        if college.has_dental:  result.append(("Dental",  WEIGHTS["Dental"]))
        if college.has_nursing: result.append(("Nursing", WEIGHTS["Nursing"]))
    if college.is_pg:
        result.append(("PG", WEIGHTS["PG"]))
    return result


# ── Helper: proportional seat split across programs ──────────────────────────

def _split_by_weight(
    total: int,
    items: list[tuple[str, int]],   # [(name, weight)]
) -> list[tuple[str, int]]:         # [(name, seats)]
    """Proportional distribution; remainder added to the last item."""
    if not items:
        return []
    total_w = sum(w for _, w in items)
    result: list[tuple[str, int]] = []
    allocated = 0
    for i, (name, weight) in enumerate(items):
        if i == len(items) - 1:
            seats = total - allocated
        else:
            seats = (total * weight) // total_w
        seats = max(seats, 1)
        result.append((name, seats))
        allocated += seats
    return result


# ── Helper: equal seat split across a flat list of strings ───────────────────

def _split_equal(total: int, names: list[str]) -> list[tuple[str, int]]:
    """Equal distribution; remainder added to the last item."""
    if not names:
        return []
    n    = len(names)
    base = total // n
    rem  = total % n
    out  = [(name, base) for name in names]
    if rem and out:
        last_name, last_seats = out[-1]
        out[-1] = (last_name, last_seats + rem)
    return out


# ── Core builder ─────────────────────────────────────────────────────────────

def _build_entries(college: College) -> list[dict]:
    """
    Returns a list of dicts, each describing one SeatEntry to be created:
      {program, department, seats, display_order}
    """
    programs_weighted = _derive_programs(college)
    if not programs_weighted:
        return []

    available = {name for name, _ in programs_weighted}

    # Step 1 — split intake_seats across programs
    program_seats: dict[str, int] = dict(
        _split_by_weight(college.intake_seats, programs_weighted)
    )

    # Step 2 — classify college departments into programs
    dept_names: list[str] = list(
        college.departments.values_list("name", flat=True)
    )
    program_depts: dict[str, list[str]] = {p: [] for p in available}
    for d in dept_names:
        prog = _classify_dept(d, available)
        program_depts[prog].append(d)

    # Step 3 — build final entries
    entries: list[dict] = []
    order = 0

    for prog_name, _ in programs_weighted:
        prog_total = program_seats[prog_name]
        depts      = program_depts.get(prog_name, [])

        if not depts:
            # No departments on this college for this program → program-level row
            entries.append({
                "program":       prog_name,
                "department":    "",
                "seats":         prog_total,
                "display_order": order,
            })
            order += 1
        else:
            # Distribute program seats equally across its departments
            for dept_name, dept_seats in _split_equal(prog_total, depts):
                if dept_seats > 0:
                    entries.append({
                        "program":       prog_name,
                        "department":    dept_name,
                        "seats":         dept_seats,
                        "display_order": order,
                    })
                    order += 1

    return entries


# ══════════════════════════════════════════════════════════════════ COMMAND ══

class Command(BaseCommand):
    help = (
        "Auto-seed SeatEntry breakdown (program + department) for all colleges. "
        "Dry-run by default — pass --apply to write."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            default=False,
            help="Write to the database (default is dry-run / preview only).",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            default=False,
            help=(
                "Re-seed colleges that already have seat entries "
                "(clears existing entries and rebuilds). Has no effect without --apply."
            ),
        )

    def handle(self, *args, **options):
        apply     = options["apply"]
        overwrite = options["overwrite"]

        colleges = (
            College.objects
            .prefetch_related("departments", "seat_entries")
            .order_by("pk")
        )

        plan:    list[dict]    = []    # {college, entries, already_has}
        skipped: list[College] = []

        for college in colleges:
            already_has = college.seat_entries.exists()

            if already_has and not overwrite:
                skipped.append(college)
                continue

            if not college.intake_seats:
                self.stdout.write(
                    self.style.WARNING(
                        f"  SKIP  [{college.pk}] {college.name}"
                        f" — intake_seats is 0 or missing"
                    )
                )
                continue

            entries = _build_entries(college)
            if not entries:
                self.stdout.write(
                    self.style.WARNING(
                        f"  SKIP  [{college.pk}] {college.name}"
                        f" — could not derive any programs"
                    )
                )
                continue

            plan.append({
                "college":     college,
                "entries":     entries,
                "already_has": already_has,
            })

        # ── Print plan ────────────────────────────────────────────────────────

        self.stdout.write("")
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"{'[DRY-RUN] ' if not apply else ''}Seat Entry Seeding Plan"
            )
        )
        self.stdout.write("─" * 72)

        for item in plan:
            college = item["college"]
            action  = "OVERWRITE" if item["already_has"] else "CREATE"
            tag     = (
                self.style.WARNING(action)
                if item["already_has"]
                else self.style.SUCCESS(action)
            )
            self.stdout.write(
                f"\n  {tag}  [{college.pk}] {college.name}"
                f"  ({college.intake_seats} seats total)"
            )

            # Group entries by program for cleaner output
            current_prog = None
            for e in item["entries"]:
                if e["program"] != current_prog:
                    current_prog = e["program"]
                    self.stdout.write(
                        f"         {'':3}{'[ ' + current_prog + ' ]'}"
                    )
                dept_label = (
                    f"  {e['department']}" if e["department"] else "  (program total)"
                )
                self.stdout.write(
                    f"         {'':7}{dept_label:<40}  {e['seats']:>4} seats"
                )

        self.stdout.write("")
        self.stdout.write("─" * 72)
        self.stdout.write(f"  Colleges to seed    : {len(plan)}")
        if overwrite:
            overwrite_count = sum(1 for i in plan if i["already_has"])
            self.stdout.write(f"    of which overwrite: {overwrite_count}")
        self.stdout.write(f"  Colleges skipped    : {len(skipped)}  (already have entries)")
        total_entries = sum(len(i["entries"]) for i in plan)
        self.stdout.write(f"  SeatEntry rows      : {total_entries}")
        self.stdout.write("")

        if not plan:
            self.stdout.write(
                self.style.SUCCESS(
                    "Nothing to do — all colleges already have seat entries."
                )
            )
            return

        # ── Dry-run exit ──────────────────────────────────────────────────────

        if not apply:
            self.stdout.write(
                self.style.WARNING(
                    "[DRY-RUN] No changes written.\n"
                    "Review the plan above, then run with --apply:\n\n"
                    "  python manage.py seed_seat_entries --apply\n"
                )
            )
            return

        # ── Apply (single atomic transaction) ─────────────────────────────────

        with transaction.atomic():
            created_total = 0
            for item in plan:
                college = item["college"]

                if item["already_has"]:
                    SeatEntry.objects.filter(college=college).delete()

                SeatEntry.objects.bulk_create([
                    SeatEntry(
                        college=college,
                        program=e["program"],
                        department=e["department"],
                        seats=e["seats"],
                        display_order=e["display_order"],
                    )
                    for e in item["entries"]
                ])
                created_total += len(item["entries"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Done.  Created {created_total} SeatEntry rows"
                f" across {len(plan)} colleges."
            )
        )
        self.stdout.write(
            "  Admins can refine any breakdown from the college detail page"
            " → Intake Seats → Edit Breakdown.\n"
        )
