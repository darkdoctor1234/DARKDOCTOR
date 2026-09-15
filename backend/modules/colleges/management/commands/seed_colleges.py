"""
Management command: seed 50 test colleges that cover every filter combination.

Usage
-----
  python manage.py seed_colleges           # create 50 colleges
  python manage.py seed_colleges --clean   # delete exactly those 50 colleges

How cleanup works
-----------------
After seeding, a file `seed_ids.json` is written next to this command.
--clean reads that file and deletes only the colleges whose PKs are listed there,
so real data is never touched.

Cascade behaviour
-----------------
Deleting a College row cascades to:
  • colleges.Department   (ForeignKey College, on_delete=CASCADE)
  • colleges.SeatEntry    (ForeignKey College, on_delete=CASCADE)

Django's ORM handles this at the Python level — it collects and deletes all
related rows before removing the College. The breakdown dict returned by
QuerySet.delete() is captured and printed explicitly so every model type that
was touched is visible in the output. No silent failures.
"""

import json
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from modules.colleges.models import College, Department

# Path where seeded PKs are remembered between seed / clean runs
SEED_FILE = os.path.join(os.path.dirname(__file__), "seed_ids.json")

# ── 50 test colleges ─────────────────────────────────────────────────────────
# Coverage matrix
#   college_type : govt (25), private (25)
#   level        : UG-only (15 govt + 12 priv), PG-only (5 govt + 5 priv), UG+PG (5 govt + 8 priv)
#   courses      : all 7 combinations of MBBS / Dental / Nursing
#   states       : 18 different Indian states
# ─────────────────────────────────────────────────────────────────────────────
COLLEGES = [

    # ══════════════════════════════════════════════════════════════════════════
    # SET A — Govt · UG only  (15 colleges, all 7 course combos represented)
    # ══════════════════════════════════════════════════════════════════════════

    # 1. Govt · UG · MBBS only
    {
        "name": "Government Medical College, Mumbai",
        "intake_seats": 250, "established_year": 1956,
        "location": "Mumbai", "state": "Maharashtra",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Biochemistry", "Pathology", "Microbiology",
            "Pharmacology", "Community Medicine", "Internal Medicine", "Surgery",
            "Paediatrics", "Obstetrics & Gynaecology", "Orthopaedics",
            "Radiology", "Anaesthesiology", "Dermatology", "ENT", "Ophthalmology",
        ],
    },
    # 2. Govt · UG · MBBS only
    {
        "name": "Kerala Government Medical College, Thiruvananthapuram",
        "intake_seats": 150, "established_year": 1951,
        "location": "Thiruvananthapuram", "state": "Kerala",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Paediatrics", "Obstetrics & Gynaecology", "Orthopaedics",
            "Dermatology", "ENT", "Ophthalmology", "Psychiatry",
        ],
    },
    # 3. Govt · UG · Dental only
    {
        "name": "Government Dental College, Chennai",
        "intake_seats": 100, "established_year": 1962,
        "location": "Chennai", "state": "Tamil Nadu",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": True, "has_nursing": False,
        "departments": [
            "Oral & Maxillofacial Surgery", "Orthodontics", "Periodontics",
            "Prosthodontics", "Conservative Dentistry", "Oral Medicine",
            "Pedodontics", "Public Health Dentistry",
        ],
    },
    # 4. Govt · UG · Dental only
    {
        "name": "Punjab Government Dental College, Amritsar",
        "intake_seats": 60, "established_year": 1985,
        "location": "Amritsar", "state": "Punjab",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": True, "has_nursing": False,
        "departments": [
            "Oral & Maxillofacial Surgery", "Orthodontics", "Periodontics",
            "Prosthodontics", "Conservative Dentistry", "Pedodontics",
        ],
    },
    # 5. Govt · UG · Nursing only
    {
        "name": "Rajiv Gandhi Nursing College, Bhopal",
        "intake_seats": 60, "established_year": 1988,
        "location": "Bhopal", "state": "Madhya Pradesh",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": False, "has_nursing": True,
        "departments": [
            "Medical-Surgical Nursing", "Community Health Nursing",
            "Mental Health Nursing", "Child Health Nursing",
            "Obstetrical & Gynaecological Nursing",
        ],
    },
    # 6. Govt · UG · Nursing only
    {
        "name": "Odisha Government Nursing College, Bhubaneswar",
        "intake_seats": 40, "established_year": 1992,
        "location": "Bhubaneswar", "state": "Odisha",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": False, "has_nursing": True,
        "departments": [
            "Medical-Surgical Nursing", "Community Health Nursing",
            "Mental Health Nursing", "Obstetrical & Gynaecological Nursing",
        ],
    },
    # 7. Govt · UG · MBBS + Dental
    {
        "name": "Government Medical & Dental College, Ahmedabad",
        "intake_seats": 180, "established_year": 1971,
        "location": "Ahmedabad", "state": "Gujarat",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": True, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Oral & Maxillofacial Surgery", "Orthodontics",
            "Periodontics", "Prosthodontics", "Conservative Dentistry",
        ],
    },
    # 8. Govt · UG · MBBS + Dental
    {
        "name": "Rajasthan Medical & Dental College, Jaipur",
        "intake_seats": 175, "established_year": 1964,
        "location": "Jaipur", "state": "Rajasthan",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": True, "has_nursing": False,
        "departments": [
            "Internal Medicine", "Surgery", "Paediatrics",
            "Oral & Maxillofacial Surgery", "Conservative Dentistry", "Periodontics",
        ],
    },
    # 9. Govt · UG · MBBS + Nursing
    {
        "name": "State Medical & Nursing College, Patna",
        "intake_seats": 120, "established_year": 1983,
        "location": "Patna", "state": "Bihar",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": False, "has_nursing": True,
        "departments": [
            "Internal Medicine", "Surgery", "Paediatrics",
            "Medical-Surgical Nursing", "Community Health Nursing", "Child Health Nursing",
        ],
    },
    # 10. Govt · UG · MBBS + Nursing
    {
        "name": "Telangana Government Medical College, Hyderabad",
        "intake_seats": 220, "established_year": 1967,
        "location": "Hyderabad", "state": "Telangana",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": False, "has_nursing": True,
        "departments": [
            "Anatomy", "Physiology", "Biochemistry",
            "Internal Medicine", "Surgery", "Paediatrics",
            "Medical-Surgical Nursing", "Community Health Nursing",
        ],
    },
    # 11. Govt · UG · Dental + Nursing
    {
        "name": "Government College of Dental Science, Bengaluru",
        "intake_seats": 80, "established_year": 1969,
        "location": "Bengaluru", "state": "Karnataka",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": True, "has_nursing": True,
        "departments": [
            "Oral & Maxillofacial Surgery", "Orthodontics", "Conservative Dentistry",
            "Medical-Surgical Nursing", "Community Health Nursing",
        ],
    },
    # 12. Govt · UG · MBBS + Dental + Nursing
    {
        "name": "Andhra Pradesh Government Medical College, Vijayawada",
        "intake_seats": 200, "established_year": 1976,
        "location": "Vijayawada", "state": "Andhra Pradesh",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": True, "has_nursing": True,
        "departments": [
            "Anatomy", "Physiology", "Biochemistry", "Pathology",
            "Internal Medicine", "Surgery", "Paediatrics",
            "Oral & Maxillofacial Surgery", "Orthodontics",
            "Medical-Surgical Nursing", "Community Health Nursing",
        ],
    },
    # 13. Govt · UG · MBBS + Dental + Nursing
    {
        "name": "Uttar Pradesh State Medical College, Lucknow",
        "intake_seats": 200, "established_year": 1961,
        "location": "Lucknow", "state": "Uttar Pradesh",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": True, "has_nursing": True,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Oral & Maxillofacial Surgery", "Orthodontics",
            "Medical-Surgical Nursing", "Community Health Nursing", "Child Health Nursing",
        ],
    },
    # 14. Govt · UG · MBBS only
    {
        "name": "Haryana Medical College, Rohtak",
        "intake_seats": 130, "established_year": 1973,
        "location": "Rohtak", "state": "Haryana",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Biochemistry",
            "Internal Medicine", "Surgery", "Paediatrics",
            "Obstetrics & Gynaecology", "Orthopaedics",
        ],
    },
    # 15. Govt · UG · Nursing only
    {
        "name": "West Bengal Nursing Institute, Kolkata",
        "intake_seats": 50, "established_year": 1990,
        "location": "Kolkata", "state": "West Bengal",
        "college_type": "govt", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": False, "has_nursing": True,
        "departments": [
            "Medical-Surgical Nursing", "Community Health Nursing",
            "Mental Health Nursing", "Child Health Nursing",
        ],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # SET B — Govt · PG only  (5 colleges)
    # ══════════════════════════════════════════════════════════════════════════

    # 16. Govt · PG · MBBS only
    {
        "name": "All India Institute of Medical Specialties, New Delhi",
        "intake_seats": 80, "established_year": 1970,
        "location": "New Delhi", "state": "Delhi",
        "college_type": "govt", "is_ug": False, "is_pg": True,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Neurology", "Cardiology", "Oncology", "Nephrology",
            "Gastroenterology", "Pulmonology", "Endocrinology",
        ],
    },
    # 17. Govt · PG · Dental only
    {
        "name": "National Postgraduate Dental Institute, Pune",
        "intake_seats": 50, "established_year": 1981,
        "location": "Pune", "state": "Maharashtra",
        "college_type": "govt", "is_ug": False, "is_pg": True,
        "has_mbbs": False, "has_dental": True, "has_nursing": False,
        "departments": [
            "Oral & Maxillofacial Surgery", "Orthodontics",
            "Periodontics", "Prosthodontics",
        ],
    },
    # 18. Govt · PG · Nursing only
    {
        "name": "Institute of Postgraduate Nursing, Mysuru",
        "intake_seats": 30, "established_year": 1995,
        "location": "Mysuru", "state": "Karnataka",
        "college_type": "govt", "is_ug": False, "is_pg": True,
        "has_mbbs": False, "has_dental": False, "has_nursing": True,
        "departments": [
            "Psychiatric Nursing", "Community Health Nursing",
            "Paediatric Nursing", "Oncology Nursing",
        ],
    },
    # 19. Govt · PG · MBBS + Dental
    {
        "name": "Postgraduate Medical & Dental College, Coimbatore",
        "intake_seats": 70, "established_year": 1988,
        "location": "Coimbatore", "state": "Tamil Nadu",
        "college_type": "govt", "is_ug": False, "is_pg": True,
        "has_mbbs": True, "has_dental": True, "has_nursing": False,
        "departments": [
            "Neurology", "Cardiology", "Oral & Maxillofacial Surgery",
            "Periodontics", "Prosthodontics",
        ],
    },
    # 20. Govt · PG · MBBS + Nursing
    {
        "name": "Gujarat Advanced Medical Studies Institute, Surat",
        "intake_seats": 60, "established_year": 1979,
        "location": "Surat", "state": "Gujarat",
        "college_type": "govt", "is_ug": False, "is_pg": True,
        "has_mbbs": True, "has_dental": False, "has_nursing": True,
        "departments": [
            "Cardiology", "Nephrology", "Oncology",
            "Psychiatric Nursing", "Community Health Nursing",
        ],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # SET C — Govt · UG + PG  (5 colleges)
    # ══════════════════════════════════════════════════════════════════════════

    # 21. Govt · UG+PG · MBBS only
    {
        "name": "Maulana Azad Medical College, New Delhi",
        "intake_seats": 300, "established_year": 1958,
        "location": "New Delhi", "state": "Delhi",
        "college_type": "govt", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Biochemistry", "Pathology",
            "Internal Medicine", "Surgery", "Paediatrics",
            "Cardiology", "Neurology", "Oncology",
        ],
    },
    # 22. Govt · UG+PG · MBBS + Dental
    {
        "name": "Madras Medical College, Chennai",
        "intake_seats": 250, "established_year": 1835,
        "location": "Chennai", "state": "Tamil Nadu",
        "college_type": "govt", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": True, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Oral & Maxillofacial Surgery", "Orthodontics",
            "Cardiology", "Neurology",
        ],
    },
    # 23. Govt · UG+PG · MBBS + Dental + Nursing
    {
        "name": "KGMU Medical University, Lucknow",
        "intake_seats": 280, "established_year": 1905,
        "location": "Lucknow", "state": "Uttar Pradesh",
        "college_type": "govt", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": True, "has_nursing": True,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery", "Paediatrics",
            "Oral & Maxillofacial Surgery",
            "Medical-Surgical Nursing", "Cardiology", "Nephrology",
        ],
    },
    # 24. Govt · UG+PG · MBBS + Nursing
    {
        "name": "B.J. Medical College, Ahmedabad",
        "intake_seats": 200, "established_year": 1946,
        "location": "Ahmedabad", "state": "Gujarat",
        "college_type": "govt", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": False, "has_nursing": True,
        "departments": [
            "Anatomy", "Physiology", "Biochemistry",
            "Internal Medicine", "Surgery", "Cardiology",
            "Medical-Surgical Nursing", "Community Health Nursing",
        ],
    },
    # 25. Govt · UG+PG · MBBS only
    {
        "name": "Karnataka Medical Sciences Institute, Hubli",
        "intake_seats": 160, "established_year": 1963,
        "location": "Hubli", "state": "Karnataka",
        "college_type": "govt", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Paediatrics", "Orthopaedics", "Cardiology", "Neurology",
        ],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # SET D — Private · UG only  (12 colleges)
    # ══════════════════════════════════════════════════════════════════════════

    # 26. Private · UG · MBBS only
    {
        "name": "Amrita Institute of Medical Sciences, Kochi",
        "intake_seats": 150, "established_year": 1998,
        "location": "Kochi", "state": "Kerala",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Biochemistry",
            "Internal Medicine", "Surgery", "Paediatrics",
            "Obstetrics & Gynaecology", "Orthopaedics",
        ],
    },
    # 27. Private · UG · MBBS only
    {
        "name": "KLE Medical College, Belagavi",
        "intake_seats": 150, "established_year": 1979,
        "location": "Belagavi", "state": "Karnataka",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Biochemistry", "Pathology",
            "Internal Medicine", "Surgery", "Paediatrics", "Orthopaedics",
        ],
    },
    # 28. Private · UG · MBBS only
    {
        "name": "Apollo Medical College, Hyderabad",
        "intake_seats": 150, "established_year": 1994,
        "location": "Hyderabad", "state": "Telangana",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Biochemistry",
            "Internal Medicine", "Surgery", "Paediatrics", "Obstetrics & Gynaecology",
        ],
    },
    # 29. Private · UG · Dental only
    {
        "name": "Manipal College of Dental Sciences, Manipal",
        "intake_seats": 80, "established_year": 1992,
        "location": "Manipal", "state": "Karnataka",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": True, "has_nursing": False,
        "departments": [
            "Oral & Maxillofacial Surgery", "Orthodontics", "Periodontics",
            "Prosthodontics", "Conservative Dentistry", "Oral Medicine", "Pedodontics",
        ],
    },
    # 30. Private · UG · Dental only
    {
        "name": "Saveetha Dental College, Chennai",
        "intake_seats": 100, "established_year": 1988,
        "location": "Chennai", "state": "Tamil Nadu",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": True, "has_nursing": False,
        "departments": [
            "Oral & Maxillofacial Surgery", "Orthodontics",
            "Conservative Dentistry", "Periodontics", "Prosthodontics",
        ],
    },
    # 31. Private · UG · Nursing only
    {
        "name": "Christian Medical College Nursing School, Vellore",
        "intake_seats": 80, "established_year": 1900,
        "location": "Vellore", "state": "Tamil Nadu",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": False, "has_nursing": True,
        "departments": [
            "Medical-Surgical Nursing", "Community Health Nursing",
            "Mental Health Nursing", "Child Health Nursing",
            "Obstetrical & Gynaecological Nursing",
        ],
    },
    # 32. Private · UG · Nursing only
    {
        "name": "Shree Dhanwantary Nursing College, Surat",
        "intake_seats": 50, "established_year": 2007,
        "location": "Surat", "state": "Gujarat",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": False, "has_nursing": True,
        "departments": [
            "Medical-Surgical Nursing", "Community Health Nursing", "Mental Health Nursing",
        ],
    },
    # 33. Private · UG · MBBS + Dental
    {
        "name": "Sri Ramachandra Medical College, Chennai",
        "intake_seats": 100, "established_year": 1985,
        "location": "Chennai", "state": "Tamil Nadu",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": True, "has_nursing": False,
        "departments": [
            "Anatomy", "Internal Medicine", "Surgery",
            "Oral & Maxillofacial Surgery", "Orthodontics", "Conservative Dentistry",
        ],
    },
    # 34. Private · UG · MBBS + Dental
    {
        "name": "Vinayaka Missions Medical College, Salem",
        "intake_seats": 100, "established_year": 2004,
        "location": "Salem", "state": "Tamil Nadu",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": True, "has_nursing": False,
        "departments": [
            "Anatomy", "Internal Medicine", "Surgery",
            "Oral & Maxillofacial Surgery", "Periodontics",
        ],
    },
    # 35. Private · UG · MBBS + Nursing
    {
        "name": "SRM Medical College, Kattankulathur",
        "intake_seats": 150, "established_year": 2002,
        "location": "Kattankulathur", "state": "Tamil Nadu",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": False, "has_nursing": True,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Medical-Surgical Nursing", "Child Health Nursing",
        ],
    },
    # 36. Private · UG · Dental + Nursing
    {
        "name": "Saveetha Allied Health Sciences, Chennai",
        "intake_seats": 70, "established_year": 2000,
        "location": "Chennai", "state": "Tamil Nadu",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": False, "has_dental": True, "has_nursing": True,
        "departments": [
            "Oral & Maxillofacial Surgery", "Orthodontics", "Conservative Dentistry",
            "Medical-Surgical Nursing", "Community Health Nursing",
        ],
    },
    # 37. Private · UG · MBBS + Dental + Nursing
    {
        "name": "D.Y. Patil Medical College, Pune",
        "intake_seats": 175, "established_year": 1996,
        "location": "Pune", "state": "Maharashtra",
        "college_type": "private", "is_ug": True, "is_pg": False,
        "has_mbbs": True, "has_dental": True, "has_nursing": True,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Oral & Maxillofacial Surgery", "Orthodontics",
            "Medical-Surgical Nursing", "Community Health Nursing",
        ],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # SET E — Private · PG only  (5 colleges)
    # ══════════════════════════════════════════════════════════════════════════

    # 38. Private · PG · MBBS only
    {
        "name": "Narayana Postgraduate Medical Academy, Bengaluru",
        "intake_seats": 60, "established_year": 2005,
        "location": "Bengaluru", "state": "Karnataka",
        "college_type": "private", "is_ug": False, "is_pg": True,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Cardiology", "Neurology", "Nephrology",
            "Gastroenterology", "Oncology", "Pulmonology",
        ],
    },
    # 39. Private · PG · Dental only
    {
        "name": "Pacific Dental Postgraduate Centre, Udaipur",
        "intake_seats": 40, "established_year": 2008,
        "location": "Udaipur", "state": "Rajasthan",
        "college_type": "private", "is_ug": False, "is_pg": True,
        "has_mbbs": False, "has_dental": True, "has_nursing": False,
        "departments": [
            "Oral & Maxillofacial Surgery", "Orthodontics",
            "Periodontics", "Prosthodontics", "Conservative Dentistry",
        ],
    },
    # 40. Private · PG · Nursing only
    {
        "name": "National Postgraduate Nursing Institute, Mumbai",
        "intake_seats": 30, "established_year": 2003,
        "location": "Mumbai", "state": "Maharashtra",
        "college_type": "private", "is_ug": False, "is_pg": True,
        "has_mbbs": False, "has_dental": False, "has_nursing": True,
        "departments": [
            "Psychiatric Nursing", "Community Health Nursing",
            "Paediatric Nursing", "Oncology Nursing",
        ],
    },
    # 41. Private · PG · MBBS + Dental
    {
        "name": "Fortis Institute of Advanced Medicine, Gurgaon",
        "intake_seats": 50, "established_year": 2010,
        "location": "Gurgaon", "state": "Haryana",
        "college_type": "private", "is_ug": False, "is_pg": True,
        "has_mbbs": True, "has_dental": True, "has_nursing": False,
        "departments": [
            "Cardiology", "Neurology", "Oncology",
            "Oral & Maxillofacial Surgery", "Prosthodontics",
        ],
    },
    # 42. Private · PG · MBBS + Nursing
    {
        "name": "Medanta Advanced Studies Institute, Lucknow",
        "intake_seats": 45, "established_year": 2012,
        "location": "Lucknow", "state": "Uttar Pradesh",
        "college_type": "private", "is_ug": False, "is_pg": True,
        "has_mbbs": True, "has_dental": False, "has_nursing": True,
        "departments": [
            "Cardiology", "Nephrology",
            "Psychiatric Nursing", "Oncology Nursing",
        ],
    },

    # ══════════════════════════════════════════════════════════════════════════
    # SET F — Private · UG + PG  (8 colleges)
    # ══════════════════════════════════════════════════════════════════════════

    # 43. Private · UG+PG · MBBS only
    {
        "name": "Kasturba Medical College, Manipal",
        "intake_seats": 200, "established_year": 1953,
        "location": "Manipal", "state": "Karnataka",
        "college_type": "private", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Biochemistry", "Pathology",
            "Internal Medicine", "Surgery", "Paediatrics",
            "Cardiology", "Neurology", "Oncology",
        ],
    },
    # 44. Private · UG+PG · MBBS only
    {
        "name": "Sri Siddhartha Medical College, Tumkur",
        "intake_seats": 100, "established_year": 1995,
        "location": "Tumkur", "state": "Karnataka",
        "college_type": "private", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": False, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Paediatrics", "Obstetrics & Gynaecology", "Cardiology",
        ],
    },
    # 45. Private · UG+PG · MBBS + Dental
    {
        "name": "Sri Balaji Medical College, Chennai",
        "intake_seats": 150, "established_year": 2000,
        "location": "Chennai", "state": "Tamil Nadu",
        "college_type": "private", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": True, "has_nursing": False,
        "departments": [
            "Anatomy", "Internal Medicine", "Surgery",
            "Oral & Maxillofacial Surgery", "Periodontics",
            "Cardiology", "Gastroenterology",
        ],
    },
    # 46. Private · UG+PG · MBBS + Dental
    {
        "name": "Yenepoya Medical College, Mangaluru",
        "intake_seats": 100, "established_year": 1997,
        "location": "Mangaluru", "state": "Karnataka",
        "college_type": "private", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": True, "has_nursing": False,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Oral & Maxillofacial Surgery", "Orthodontics",
            "Neurology", "Cardiology",
        ],
    },
    # 47. Private · UG+PG · MBBS + Nursing
    {
        "name": "MGM Medical College, Navi Mumbai",
        "intake_seats": 150, "established_year": 1989,
        "location": "Navi Mumbai", "state": "Maharashtra",
        "college_type": "private", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": False, "has_nursing": True,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery", "Paediatrics",
            "Medical-Surgical Nursing", "Community Health Nursing", "Cardiology",
        ],
    },
    # 48. Private · UG+PG · Dental + Nursing
    {
        "name": "Sharda Medical College, Greater Noida",
        "intake_seats": 120, "established_year": 2006,
        "location": "Greater Noida", "state": "Uttar Pradesh",
        "college_type": "private", "is_ug": True, "is_pg": True,
        "has_mbbs": False, "has_dental": True, "has_nursing": True,
        "departments": [
            "Oral & Maxillofacial Surgery", "Orthodontics", "Periodontics",
            "Medical-Surgical Nursing", "Community Health Nursing", "Psychiatric Nursing",
        ],
    },
    # 49. Private · UG+PG · MBBS + Dental + Nursing
    {
        "name": "Nitte University Medical College, Mangaluru",
        "intake_seats": 120, "established_year": 1990,
        "location": "Mangaluru", "state": "Karnataka",
        "college_type": "private", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": True, "has_nursing": True,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Oral & Maxillofacial Surgery", "Orthodontics",
            "Medical-Surgical Nursing", "Cardiology", "Neurology",
        ],
    },
    # 50. Private · UG+PG · MBBS + Dental + Nursing
    {
        "name": "Rama Medical College, Kanpur",
        "intake_seats": 130, "established_year": 2001,
        "location": "Kanpur", "state": "Uttar Pradesh",
        "college_type": "private", "is_ug": True, "is_pg": True,
        "has_mbbs": True, "has_dental": True, "has_nursing": True,
        "departments": [
            "Anatomy", "Physiology", "Internal Medicine", "Surgery",
            "Oral & Maxillofacial Surgery", "Conservative Dentistry",
            "Medical-Surgical Nursing", "Neurology", "Nephrology",
        ],
    },
]


class Command(BaseCommand):
    help = "Seed 50 test colleges (--clean removes them without touching real data)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Delete the seeded test colleges using stored PKs",
        )

    def handle(self, *args, **options):
        if options["clean"]:
            self._clean()
        else:
            self._seed()

    # ── seed ──────────────────────────────────────────────────────────────────

    def _seed(self):
        if os.path.exists(SEED_FILE):
            raise CommandError(
                "seed_ids.json already exists — test colleges were already seeded.\n"
                "Run  python manage.py seed_colleges --clean  first if you want to reseed."
            )

        assert len(COLLEGES) == 50, f"Expected 50 entries, got {len(COLLEGES)}"

        created_ids = []
        for data in COLLEGES:
            departments = data.pop("departments", [])
            college = College.objects.create(**data)
            for dept_name in departments:
                Department.objects.get_or_create(college=college, name=dept_name)
            created_ids.append(college.pk)
            self.stdout.write(f"  ✓  {college.name}")

        # ── Apply full addresses automatically ────────────────────────────────
        # COLLEGES list stores city-only locations for readability. Import the
        # canonical full-address map and apply it so every re-seed produces
        # Google-Maps-ready addresses without a separate command.
        try:
            from modules.colleges.management.commands.update_college_locations import ADDRESS_MAP
            addr_count = 0
            for college_id, name in zip(
                created_ids,
                [c["name"] for c in COLLEGES],  # original order preserved
            ):
                full_addr = ADDRESS_MAP.get(name)
                if full_addr:
                    College.objects.filter(pk=college_id).update(location=full_addr)
                    addr_count += 1
            if addr_count:
                self.stdout.write(f"  + Full addresses applied to {addr_count} colleges.")
        except Exception as exc:
            self.stdout.write(
                self.style.WARNING(
                    f"  ! Could not auto-apply full addresses: {exc}\n"
                    "    Run: python manage.py update_college_locations --apply"
                )
            )

        # Persist PKs so --clean can remove exactly these records
        with open(SEED_FILE, "w") as f:
            json.dump(created_ids, f, indent=2)

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSeeded {len(created_ids)} test colleges.  "
                f"IDs saved to seed_ids.json.\n"
                f"Run  python manage.py seed_colleges --clean  to remove them."
            )
        )

    # ── clean ─────────────────────────────────────────────────────────────────

    def _clean(self):
        if not os.path.exists(SEED_FILE):
            raise CommandError(
                "seed_ids.json not found — nothing to clean.\n"
                "Run  python manage.py seed_colleges  first."
            )

        with open(SEED_FILE) as f:
            ids = json.load(f)

        self.stdout.write(
            f"Deleting {len(ids)} seeded college(s) and all cascade-linked rows…"
        )

        # ── Single atomic transaction ─────────────────────────────────────────
        # If anything inside fails, the entire delete is rolled back and the
        # seed_ids.json file is NOT removed (state stays consistent).
        with transaction.atomic():
            total_deleted, breakdown = (
                College.objects.filter(pk__in=ids).delete()
            )

        # ── File removal is outside the transaction (filesystem, not DB) ──────
        # We only reach this line if the transaction committed successfully.
        os.remove(SEED_FILE)

        # ── Explicit per-model report — no silent omissions ───────────────────
        colleges_deleted      = breakdown.get("colleges.College",      0)
        departments_deleted   = breakdown.get("colleges.Department",   0)
        seat_entries_deleted  = breakdown.get("colleges.SeatEntry",    0)
        fee_entries_deleted   = breakdown.get("colleges.FeeEntry",     0)
        stip_entries_deleted  = breakdown.get("colleges.StipendEntry", 0)

        self.stdout.write(self.style.SUCCESS("\nClean complete. Rows deleted:"))
        self.stdout.write(f"  Colleges      : {colleges_deleted}")
        self.stdout.write(f"  Departments   : {departments_deleted}")
        self.stdout.write(f"  SeatEntries   : {seat_entries_deleted}")
        self.stdout.write(f"  FeeEntries    : {fee_entries_deleted}")
        self.stdout.write(f"  StipendEntries: {stip_entries_deleted}")
        self.stdout.write(f"  ---------------------")
        self.stdout.write(f"  Total         : {total_deleted}")
        self.stdout.write(
            self.style.SUCCESS("\nReal data untouched. seed_ids.json removed.")
        )
