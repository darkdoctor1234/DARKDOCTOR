"""
Seed all standard medical departments into every college that has none.

Usage:
  python manage.py seed_departments            # add to colleges that have 0 depts
  python manage.py seed_departments --force    # replace all depts on every college
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from modules.colleges.models import College, Department

ALL_DEPARTMENTS = [
    # Pre-Clinical
    "Anatomy",
    "Biochemistry",
    "Physiology",
    # Para-Clinical
    "Community Medicine (PSM)",
    "Forensic Medicine & Toxicology",
    "Microbiology",
    "Pathology",
    "Pharmacology",
    # Clinical MD/DNB
    "Anaesthesiology",
    "Dermatology, Venereology & Leprosy (DVL)",
    "Emergency Medicine",
    "General Medicine",
    "Paediatrics",
    "Psychiatry",
    "Radiology / Radiodiagnosis",
    "Respiratory Medicine",
    # Clinical MS/DNB
    "ENT (Otorhinolaryngology)",
    "General Surgery",
    "Obstetrics & Gynaecology",
    "Ophthalmology",
    "Orthopaedics",
    # Super-Specialty DM
    "Cardiology",
    "Critical Care Medicine",
    "Endocrinology",
    "Gastroenterology",
    "Medical Oncology",
    "Neonatology",
    "Nephrology",
    "Neurology",
    "Rheumatology",
    # Super-Specialty MCh
    "Cardiovascular & Thoracic Surgery (CTVS)",
    "Neurosurgery",
    "Paediatric Surgery",
    "Plastic & Reconstructive Surgery",
    "Surgical Gastroenterology",
    "Surgical Oncology",
    "Urology",
]


class Command(BaseCommand):
    help = "Seed standard medical departments into colleges"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Replace existing departments on all colleges",
        )

    def handle(self, *args, **options):
        force = options["force"]
        colleges = College.objects.prefetch_related("departments").all()
        created_total = 0
        skipped = 0

        with transaction.atomic():
            for college in colleges:
                if not force and college.departments.count() > 0:
                    skipped += 1
                    continue

                if force:
                    college.departments.all().delete()

                Department.objects.bulk_create([
                    Department(college=college, name=name)
                    for name in ALL_DEPARTMENTS
                ])
                created_total += len(ALL_DEPARTMENTS)

        self.stdout.write(self.style.SUCCESS(
            f"Done — added {created_total} department rows across colleges "
            f"({skipped} colleges skipped, already had departments)."
        ))
