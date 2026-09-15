# Fixed PG-specialty taxonomy — used for UserProfile.pg_department and, in the
# communities app, Community.department. Kept intentionally as a controlled
# vocabulary (not free text) so doctors in the same specialty land in the same
# community instead of fragmenting over spelling ("Cardio" vs "Cardiology").
#
# Mirrors frontend/lib/departments.ts (DEPARTMENT_GROUPS / ALL_DEPARTMENTS) —
# keep the two in sync if either changes.

PG_DEPARTMENT_GROUPS = [
    ("Pre-Clinical", ["Anatomy", "Biochemistry", "Physiology"]),
    ("Para-Clinical", [
        "Community Medicine (PSM)",
        "Forensic Medicine & Toxicology",
        "Microbiology",
        "Pathology",
        "Pharmacology",
    ]),
    ("Clinical: MD / DNB", [
        "Anaesthesiology",
        "Dermatology, Venereology & Leprosy (DVL)",
        "Emergency Medicine",
        "General Medicine",
        "Paediatrics",
        "Psychiatry",
        "Radiology / Radiodiagnosis",
        "Respiratory Medicine",
    ]),
    ("Clinical: MS / DNB", [
        "ENT (Otorhinolaryngology)",
        "General Surgery",
        "Obstetrics & Gynaecology",
        "Ophthalmology",
        "Orthopaedics",
    ]),
    ("Super-Specialty: DM", [
        "Cardiology",
        "Critical Care Medicine",
        "Endocrinology",
        "Gastroenterology",
        "Medical Oncology",
        "Neonatology",
        "Nephrology",
        "Neurology",
        "Rheumatology",
    ]),
    ("Super-Specialty: MCh", [
        "Cardiovascular & Thoracic Surgery (CTVS)",
        "Neurosurgery",
        "Paediatric Surgery",
        "Plastic & Reconstructive Surgery",
        "Surgical Gastroenterology",
        "Surgical Oncology",
        "Urology",
    ]),
]

PG_DEPARTMENTS: list[str] = [item for _group, items in PG_DEPARTMENT_GROUPS for item in items]

PG_DEPARTMENT_CHOICES = [(d, d) for d in PG_DEPARTMENTS]
