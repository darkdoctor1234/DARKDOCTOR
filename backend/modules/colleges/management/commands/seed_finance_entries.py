"""
Management command: seed realistic FeeEntry and StipendEntry data
for the 50 test colleges created by seed_colleges.py.

Safety model  (identical to seed_seat_entries.py)
-------------------------------------------------
• Reads seed_ids.json — ONLY touches those exact colleges. Real / production
  data is never accessed or modified.
• DRY-RUN by default — nothing is written until you pass --apply.
• --overwrite clears and rebuilds colleges that already have entries.
• --clean removes all fee/stipend entries from the seeded colleges only.
• Every write happens inside a single transaction.atomic().
• Per-model counts are printed on completion — no silent omissions.

Usage
-----
  python manage.py seed_finance_entries                          # preview
  python manage.py seed_finance_entries --apply                  # write
  python manage.py seed_finance_entries --apply --overwrite      # re-seed
  python manage.py seed_finance_entries --clean                  # remove entries

Fee ranges used  (annual INR)
-----------------------------
  Govt  MBBS UG      ₹20,000 – ₹60,000     step  ₹5,000
  Govt  Dental UG    ₹10,000 – ₹40,000     step  ₹5,000
  Govt  Nursing UG   ₹5,000  – ₹25,000     step  ₹1,000
  Govt  PG (medical) ₹15,000 – ₹50,000     step  ₹5,000
  Govt  PG (dental)  ₹10,000 – ₹30,000     step  ₹5,000
  Govt  PG (nursing) ₹8,000  – ₹20,000     step  ₹1,000

  Priv  MBBS UG      ₹8,00,000  – ₹25,00,000  step ₹50,000
  Priv  Dental UG    ₹4,00,000  – ₹12,00,000  step ₹25,000
  Priv  Nursing UG   ₹80,000    – ₹2,50,000   step ₹10,000
  Priv  PG (medical) ₹5,00,000  – ₹15,00,000  step ₹50,000
  Priv  PG (dental)  ₹2,50,000  – ₹8,00,000   step ₹25,000
  Priv  PG (nursing) ₹50,000    – ₹2,00,000   step ₹10,000

Stipend ranges  (monthly INR, PG programs only)
-----------------------------------------------
  Govt  PG medical   ₹40,000 – ₹75,000  step ₹5,000
  Govt  PG dental    ₹20,000 – ₹40,000  step ₹5,000
  Govt  PG nursing   ₹15,000 – ₹30,000  step ₹5,000

  Priv  PG medical   ₹20,000 – ₹55,000  step ₹5,000
  Priv  PG dental    ₹12,000 – ₹30,000  step ₹2,000
  Priv  PG nursing   ₹8,000  – ₹20,000  step ₹2,000
"""

from __future__ import annotations

import hashlib
import json
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from modules.colleges.models import College, FeeEntry, StipendEntry

# ── Path to the seed PKs file written by seed_colleges.py ────────────────────
SEED_FILE = os.path.join(os.path.dirname(__file__), "seed_ids.json")

# ── Fee ranges: keyed by (college_type, level, course) ───────────────────────
# Each tuple is  (lo, hi, step)  — amount in whole rupees.
FEE_RANGES: dict[tuple[str, str, str], tuple[int, int, int]] = {
    ("govt",    "ug", "mbbs"):    (20_000,    60_000,   5_000),
    ("govt",    "ug", "dental"):  (10_000,    40_000,   5_000),
    ("govt",    "ug", "nursing"): ( 5_000,    25_000,   1_000),
    ("govt",    "pg", "mbbs"):    (15_000,    50_000,   5_000),
    ("govt",    "pg", "dental"):  (10_000,    30_000,   5_000),
    ("govt",    "pg", "nursing"): ( 8_000,    20_000,   1_000),
    ("private", "ug", "mbbs"):    (800_000, 2_500_000,  50_000),
    ("private", "ug", "dental"):  (400_000, 1_200_000,  25_000),
    ("private", "ug", "nursing"): ( 80_000,   250_000,  10_000),
    ("private", "pg", "mbbs"):    (500_000, 1_500_000,  50_000),
    ("private", "pg", "dental"):  (250_000,   800_000,  25_000),
    ("private", "pg", "nursing"): ( 50_000,   200_000,  10_000),
}

# ── Stipend ranges: keyed by (college_type, course) ──────────────────────────
# Monthly amounts, in whole rupees. PG programs only.
STIPEND_RANGES: dict[tuple[str, str], tuple[int, int, int]] = {
    ("govt",    "mbbs"):    (40_000, 75_000, 5_000),
    ("govt",    "dental"):  (20_000, 40_000, 5_000),
    ("govt",    "nursing"): (15_000, 30_000, 5_000),
    ("private", "mbbs"):    (20_000, 55_000, 5_000),
    ("private", "dental"):  (12_000, 30_000, 2_000),
    ("private", "nursing"): ( 8_000, 20_000, 2_000),
}


# ── Deterministic amount generator ───────────────────────────────────────────

def _det_amount(college_pk: int, key: str, lo: int, hi: int, step: int) -> int:
    """
    Returns a deterministic, reproducible amount in [lo, hi] rounded to
    the nearest `step`.  Uses an MD5 hash of (college_pk, key) as the
    random seed — same inputs always produce the same output.
    """
    digest  = hashlib.md5(f"{college_pk}:{key}".encode()).hexdigest()
    frac    = int(digest[:8], 16) / 0xFFFF_FFFF      # 0.0 … 1.0
    raw     = lo + (hi - lo) * frac
    rounded = round(raw / step) * step
    # Clamp to [lo, hi] in case rounding pushes slightly outside
    return max(lo, min(hi, rounded))


# ── Program-label helpers ─────────────────────────────────────────────────────

def _pg_label(college: College, course: str) -> str:
    """
    Returns the display label for a PG program entry.
      - Single-course PG college  → "PG"
      - Multi-course  PG college  → "PG (Medical)" / "PG (Dental)" / "PG (Nursing)"
    """
    pg_courses = sum([college.has_mbbs, college.has_dental, college.has_nursing])
    if pg_courses == 1:
        return "PG"
    return {"mbbs": "PG (Medical)", "dental": "PG (Dental)", "nursing": "PG (Nursing)"}[course]


# ── Build fee entries for one college ────────────────────────────────────────

def _build_fee_entries(college: College) -> list[dict]:
    """
    Returns a list of fee-entry dicts for the college.

    UG programs → annual course fee.
    PG programs → annual PG fee (separate entry per course if multiple).
    """
    ctype   = college.college_type   # "govt" | "private"
    entries = []
    order   = 0

    # ── UG entries ────────────────────────────────────────────────────────────
    if college.is_ug:
        for course, flag, label in [
            ("mbbs",    college.has_mbbs,    "MBBS"),
            ("dental",  college.has_dental,  "Dental"),
            ("nursing", college.has_nursing, "Nursing"),
        ]:
            if not flag:
                continue
            lo, hi, step = FEE_RANGES[(ctype, "ug", course)]
            amount = _det_amount(college.pk, f"fee_ug_{course}", lo, hi, step)
            entries.append({
                "program":       label,
                "department":    "",
                "amount":        amount,
                "display_order": order,
            })
            order += 1

    # ── PG entries ────────────────────────────────────────────────────────────
    if college.is_pg:
        for course, flag in [
            ("mbbs",    college.has_mbbs),
            ("dental",  college.has_dental),
            ("nursing", college.has_nursing),
        ]:
            if not flag:
                continue
            lo, hi, step = FEE_RANGES[(ctype, "pg", course)]
            amount = _det_amount(college.pk, f"fee_pg_{course}", lo, hi, step)
            entries.append({
                "program":       _pg_label(college, course),
                "department":    "",
                "amount":        amount,
                "display_order": order,
            })
            order += 1

    return entries


# ── Build stipend entries for one college ────────────────────────────────────

def _build_stipend_entries(college: College) -> list[dict]:
    """
    Returns a list of stipend-entry dicts for the college.
    Only PG programs receive stipends.  UG-only colleges return [].
    """
    if not college.is_pg:
        return []

    ctype   = college.college_type
    entries = []
    order   = 0

    for course, flag in [
        ("mbbs",    college.has_mbbs),
        ("dental",  college.has_dental),
        ("nursing", college.has_nursing),
    ]:
        if not flag:
            continue
        lo, hi, step = STIPEND_RANGES[(ctype, course)]
        amount = _det_amount(college.pk, f"stipend_pg_{course}", lo, hi, step)
        entries.append({
            "program":       _pg_label(college, course),
            "department":    "",
            "amount":        amount,
            "display_order": order,
        })
        order += 1

    return entries


# ── Currency formatting for output ───────────────────────────────────────────

def _inr(amount: int) -> str:
    return f"Rs.{amount:,}"


# ══════════════════════════════════════════════════════════════════ COMMAND ══

class Command(BaseCommand):
    help = (
        "Seed FeeEntry + StipendEntry data for the 50 test colleges. "
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
                "Re-seed colleges that already have fee/stipend entries "
                "(clears and rebuilds). Has no effect without --apply."
            ),
        )
        parser.add_argument(
            "--clean",
            action="store_true",
            default=False,
            help=(
                "Remove ALL FeeEntry and StipendEntry rows that belong to the "
                "50 seeded colleges. Does NOT remove the colleges themselves."
            ),
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._clean()
        else:
            self._seed(apply=options["apply"], overwrite=options["overwrite"])

    # ── clean ─────────────────────────────────────────────────────────────────

    def _clean(self):
        if not os.path.exists(SEED_FILE):
            raise CommandError(
                "seed_ids.json not found.\n"
                "Run  python manage.py seed_colleges  first to create the test colleges."
            )

        with open(SEED_FILE) as f:
            seed_ids: list[int] = json.load(f)

        self.stdout.write(
            f"Removing FeeEntry and StipendEntry rows for "
            f"{len(seed_ids)} seeded colleges..."
        )

        with transaction.atomic():
            fee_deleted,     _ = FeeEntry.objects.filter(college_id__in=seed_ids).delete()
            stipend_deleted, _ = StipendEntry.objects.filter(college_id__in=seed_ids).delete()

        self.stdout.write(self.style.SUCCESS("\nClean complete. Rows deleted:"))
        self.stdout.write(f"  FeeEntry     : {fee_deleted}")
        self.stdout.write(f"  StipendEntry : {stipend_deleted}")
        self.stdout.write(f"  --------------------")
        self.stdout.write(f"  Total        : {fee_deleted + stipend_deleted}")
        self.stdout.write(
            self.style.SUCCESS(
                "\nColleges and their seat/department data are untouched."
            )
        )

    # ── seed ──────────────────────────────────────────────────────────────────

    def _seed(self, *, apply: bool, overwrite: bool):
        if not os.path.exists(SEED_FILE):
            raise CommandError(
                "seed_ids.json not found.\n"
                "Run  python manage.py seed_colleges  first."
            )

        with open(SEED_FILE) as f:
            seed_ids: list[int] = json.load(f)

        colleges = (
            College.objects
            .prefetch_related("fee_entries", "stipend_entries")
            .filter(pk__in=seed_ids)
            .order_by("pk")
        )

        if colleges.count() != len(seed_ids):
            found = colleges.count()
            raise CommandError(
                f"Expected {len(seed_ids)} seeded colleges but found {found} in the DB.\n"
                "Re-run  python manage.py seed_colleges  to restore them."
            )

        # ── Build the plan ────────────────────────────────────────────────────
        plan:    list[dict]    = []   # {college, fees, stipends, already_has_fee, already_has_stipend}
        skipped: list[College] = []

        for college in colleges:
            already_fee     = college.fee_entries.exists()
            already_stipend = college.stipend_entries.exists()
            already_has     = already_fee or already_stipend

            if already_has and not overwrite:
                skipped.append(college)
                continue

            fees     = _build_fee_entries(college)
            stipends = _build_stipend_entries(college)

            if not fees and not stipends:
                # Should never happen given the college data, but guard anyway
                self.stdout.write(
                    self.style.WARNING(
                        f"  SKIP  [{college.pk}] {college.name} "
                        f"— could not derive any entries"
                    )
                )
                continue

            plan.append({
                "college":         college,
                "fees":            fees,
                "stipends":        stipends,
                "already_has_fee": already_fee,
                "already_has_stip":already_stipend,
            })

        # ── Print the plan ────────────────────────────────────────────────────
        self.stdout.write("")
        heading = "[DRY-RUN]  " if not apply else ""
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"{heading}Finance Entry Seeding Plan  "
                f"({len(plan)} colleges)"
            )
        )
        self.stdout.write("-" * 76)

        for item in plan:
            c      = item["college"]
            is_gov = c.college_type == "govt"
            action = (
                "OVERWRITE"
                if (item["already_has_fee"] or item["already_has_stip"])
                else "CREATE"
            )
            tag = (
                self.style.WARNING(action)
                if action == "OVERWRITE"
                else self.style.SUCCESS(action)
            )
            type_label  = "Govt" if is_gov else "Priv"
            level_parts = []
            if c.is_ug: level_parts.append("UG")
            if c.is_pg: level_parts.append("PG")
            level_label = "+".join(level_parts)
            course_parts = []
            if c.has_mbbs:    course_parts.append("MBBS")
            if c.has_dental:  course_parts.append("Dental")
            if c.has_nursing: course_parts.append("Nursing")
            course_label = "/".join(course_parts)

            self.stdout.write(
                f"\n  {tag}  [{c.pk:>3}] {c.name}"
            )
            self.stdout.write(
                f"         {type_label} · {level_label} · {course_label}"
            )

            if item["fees"]:
                self.stdout.write(
                    self.style.HTTP_INFO("         Fees (annual):")
                )
                for e in item["fees"]:
                    prog = e["program"] + (f" / {e['department']}" if e["department"] else "")
                    self.stdout.write(
                        f"           {prog:<30}  {_inr(e['amount'])}/yr"
                    )

            if item["stipends"]:
                self.stdout.write(
                    self.style.HTTP_INFO("         Stipends (monthly):")
                )
                for e in item["stipends"]:
                    prog = e["program"] + (f" / {e['department']}" if e["department"] else "")
                    self.stdout.write(
                        f"           {prog:<30}  {_inr(e['amount'])}/mo"
                    )
            else:
                self.stdout.write(
                    f"         Stipends: — (UG-only college, no stipends)"
                )

        # ── Summary row ───────────────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write("-" * 76)
        total_fee     = sum(len(i["fees"])     for i in plan)
        total_stipend = sum(len(i["stipends"]) for i in plan)
        ow_count      = sum(
            1 for i in plan
            if i["already_has_fee"] or i["already_has_stip"]
        )

        self.stdout.write(f"  Colleges to seed    : {len(plan)}")
        if overwrite:
            self.stdout.write(f"    of which overwrite: {ow_count}")
        self.stdout.write(f"  Colleges skipped    : {len(skipped)}  (already have entries)")
        self.stdout.write(f"  FeeEntry rows       : {total_fee}")
        self.stdout.write(f"  StipendEntry rows   : {total_stipend}")
        self.stdout.write(f"  Total rows          : {total_fee + total_stipend}")
        self.stdout.write("")

        if not plan:
            self.stdout.write(
                self.style.SUCCESS(
                    "Nothing to do — all colleges already have finance entries.\n"
                    "Pass --apply --overwrite to rebuild them."
                )
            )
            return

        # ── Dry-run exit ──────────────────────────────────────────────────────
        if not apply:
            self.stdout.write(
                self.style.WARNING(
                    "[DRY-RUN] No changes written.\n"
                    "Review the plan above, then run:\n\n"
                    "  python manage.py seed_finance_entries --apply\n"
                )
            )
            return

        # ── Apply — single atomic transaction ─────────────────────────────────
        with transaction.atomic():
            fee_total_created     = 0
            stipend_total_created = 0

            for item in plan:
                college = item["college"]

                # Clear existing entries if overwriting
                if item["already_has_fee"]:
                    FeeEntry.objects.filter(college=college).delete()
                if item["already_has_stip"]:
                    StipendEntry.objects.filter(college=college).delete()

                # Bulk-create fee entries
                if item["fees"]:
                    FeeEntry.objects.bulk_create([
                        FeeEntry(
                            college=college,
                            program=e["program"],
                            department=e["department"],
                            amount=e["amount"],
                            display_order=e["display_order"],
                        )
                        for e in item["fees"]
                    ])
                    fee_total_created += len(item["fees"])

                # Bulk-create stipend entries
                if item["stipends"]:
                    StipendEntry.objects.bulk_create([
                        StipendEntry(
                            college=college,
                            program=e["program"],
                            department=e["department"],
                            amount=e["amount"],
                            display_order=e["display_order"],
                        )
                        for e in item["stipends"]
                    ])
                    stipend_total_created += len(item["stipends"])

        # ── Final report ──────────────────────────────────────────────────────
        self.stdout.write(
            self.style.SUCCESS(
                f"Done.  Written across {len(plan)} colleges:"
            )
        )
        self.stdout.write(f"  FeeEntry rows created     : {fee_total_created}")
        self.stdout.write(f"  StipendEntry rows created : {stipend_total_created}")
        self.stdout.write(f"  Total rows                : {fee_total_created + stipend_total_created}")
        self.stdout.write(
            "\n  Admins can refine any breakdown from the college detail page\n"
            "  (Fee or Stipend card > Edit Breakdown).\n"
        )
