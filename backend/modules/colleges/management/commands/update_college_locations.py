"""
Management command: update location field for all 50 seeded colleges
with real full addresses (street / area, city, state, PIN).

Usage
-----
  python manage.py update_college_locations          # preview (dry-run)
  python manage.py update_college_locations --apply  # write to database
"""

from django.core.management.base import BaseCommand

from modules.colleges.models import College

# ── Full-address map ─────────────────────────────────────────────────────────
# Key   : exact college name as stored in seed_colleges.py
# Value : full address suitable for Google Maps navigation
# ─────────────────────────────────────────────────────────────────────────────
ADDRESS_MAP: dict[str, str] = {

    # ── SET A: Govt · UG only ────────────────────────────────────────────────
    "Government Medical College, Mumbai":
        "Sir J.J. Marg, Byculla, Mumbai, Maharashtra 400008",

    "Kerala Government Medical College, Thiruvananthapuram":
        "Medical College Road, Thiruvananthapuram, Kerala 695011",

    "Government Dental College, Chennai":
        "Park Town, Chennai, Tamil Nadu 600003",

    "Punjab Government Dental College, Amritsar":
        "Circular Road, Amritsar, Punjab 143001",

    "Rajiv Gandhi Nursing College, Bhopal":
        "Royal Market Road, Bhopal, Madhya Pradesh 462001",

    "Odisha Government Nursing College, Bhubaneswar":
        "Unit 6, Bhubaneswar, Odisha 751001",

    "Government Medical & Dental College, Ahmedabad":
        "Civil Hospital Campus, Asarwa, Ahmedabad, Gujarat 380016",

    "Rajasthan Medical & Dental College, Jaipur":
        "J.L.N. Marg, Jaipur, Rajasthan 302004",

    "State Medical & Nursing College, Patna":
        "Ashok Rajpath, Patna, Bihar 800004",

    "Telangana Government Medical College, Hyderabad":
        "Osmania General Hospital Campus, Afzalgunj, Hyderabad, Telangana 500012",

    "Government College of Dental Science, Bengaluru":
        "Victoria Hospital Campus, Fort Road, Bengaluru, Karnataka 560002",

    "Andhra Pradesh Government Medical College, Vijayawada":
        "Government General Hospital Campus, Suryaraopet, Vijayawada, Andhra Pradesh 520002",

    "Uttar Pradesh State Medical College, Lucknow":
        "Chowk, Lucknow, Uttar Pradesh 226003",

    "Haryana Medical College, Rohtak":
        "PGIMS Campus, Rohtak, Haryana 124001",

    "West Bengal Nursing Institute, Kolkata":
        "Medical College Road, College Street, Kolkata, West Bengal 700073",

    # ── SET B: Govt · PG only ────────────────────────────────────────────────
    "All India Institute of Medical Specialties, New Delhi":
        "Ansari Nagar East, New Delhi, Delhi 110029",

    "National Postgraduate Dental Institute, Pune":
        "Sassoon Road, Pune, Maharashtra 411001",

    "Institute of Postgraduate Nursing, Mysuru":
        "Irwin Road, Mysuru, Karnataka 570001",

    "Postgraduate Medical & Dental College, Coimbatore":
        "Avanashi Road, Coimbatore, Tamil Nadu 641014",

    "Gujarat Advanced Medical Studies Institute, Surat":
        "Ring Road, Surat, Gujarat 395002",

    # ── SET C: Govt · UG + PG ────────────────────────────────────────────────
    "Maulana Azad Medical College, New Delhi":
        "Bahadur Shah Zafar Marg, New Delhi, Delhi 110002",

    "Madras Medical College, Chennai":
        "Park Town, Chennai, Tamil Nadu 600003",

    "KGMU Medical University, Lucknow":
        "Shah Mina Road, Chowk, Lucknow, Uttar Pradesh 226003",

    "B.J. Medical College, Ahmedabad":
        "Civil Hospital Campus, Asarwa, Ahmedabad, Gujarat 380016",

    "Karnataka Medical Sciences Institute, Hubli":
        "KIMS Hospital Campus, Vidyanagar, Hubli, Karnataka 580021",

    # ── SET D: Private · UG only ─────────────────────────────────────────────
    "Amrita Institute of Medical Sciences, Kochi":
        "AIMS Ponekkara, Edappally, Kochi, Kerala 682041",

    "KLE Medical College, Belagavi":
        "JNMC Campus, Belagavi, Karnataka 590010",

    "Apollo Medical College, Hyderabad":
        "Apollo Health City, Jubilee Hills, Hyderabad, Telangana 500033",

    "Manipal College of Dental Sciences, Manipal":
        "Madhav Nagar, Manipal, Udupi, Karnataka 576104",

    "Saveetha Dental College, Chennai":
        "Saveetha Nagar, Thandalam, Chennai, Tamil Nadu 602105",

    "Christian Medical College Nursing School, Vellore":
        "Ida Scudder Road, Vellore, Tamil Nadu 632004",

    "Shree Dhanwantary Nursing College, Surat":
        "Katargam Road, Surat, Gujarat 395004",

    "Sri Ramachandra Medical College, Chennai":
        "No. 1, Ramachandra Nagar, Porur, Chennai, Tamil Nadu 600116",

    "Vinayaka Missions Medical College, Salem":
        "NH-544, Sankagiri Road, Ariyanoor, Salem, Tamil Nadu 636308",

    "SRM Medical College, Kattankulathur":
        "SRM Nagar, Kattankulathur, Chengalpattu, Tamil Nadu 603203",

    "Saveetha Allied Health Sciences, Chennai":
        "Saveetha Nagar, Thandalam, Chennai, Tamil Nadu 602105",

    "D.Y. Patil Medical College, Pune":
        "Sant Tukaram Nagar, Pimpri, Pune, Maharashtra 411018",

    # ── SET E: Private · PG only ─────────────────────────────────────────────
    "Narayana Postgraduate Medical Academy, Bengaluru":
        "Bommasandra Industrial Area, Attibele Road, Bengaluru, Karnataka 560099",

    "Pacific Dental Postgraduate Centre, Udaipur":
        "Pacific Hills, Airport Road, Udaipur, Rajasthan 313003",

    "National Postgraduate Nursing Institute, Mumbai":
        "Juhu Scheme, Santacruz West, Mumbai, Maharashtra 400054",

    "Fortis Institute of Advanced Medicine, Gurgaon":
        "Sector 44, Opposite HUDA City Centre, Gurugram, Haryana 122002",

    "Medanta Advanced Studies Institute, Lucknow":
        "Sector B, Pocket 1, Gomti Nagar Extension, Lucknow, Uttar Pradesh 226010",

    # ── SET F: Private · UG + PG ─────────────────────────────────────────────
    "Kasturba Medical College, Manipal":
        "Tiger Circle Road, Madhav Nagar, Manipal, Udupi, Karnataka 576104",

    "Sri Siddhartha Medical College, Tumkur":
        "B.H. Road, Agalakote, Tumkur, Karnataka 572107",

    "Sri Balaji Medical College, Chennai":
        "7 Works Road, Chromepet, Chennai, Tamil Nadu 600044",

    "Yenepoya Medical College, Mangaluru":
        "University Road, Deralakatte, Mangaluru, Karnataka 575018",

    "MGM Medical College, Navi Mumbai":
        "Sector 18, Kamothe, Navi Mumbai, Maharashtra 410209",

    "Sharda Medical College, Greater Noida":
        "Plot 32-34, Knowledge Park III, Greater Noida, Uttar Pradesh 201310",

    "Nitte University Medical College, Mangaluru":
        "Medical Sciences Complex, Deralakatte, Mangaluru, Karnataka 575018",

    "Rama Medical College, Kanpur":
        "Mandhana, Kanpur, Uttar Pradesh 209217",
}


class Command(BaseCommand):
    help = (
        "Update the location field of the 50 seeded colleges with full addresses. "
        "Run without --apply to preview changes first."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write the changes to the database (omit to dry-run)",
        )

    def handle(self, *args, **options):
        apply = options["apply"]
        mode = "APPLYING" if apply else "DRY-RUN (pass --apply to write)"
        sep = "-" * 60
        self.stdout.write(f"\n{sep}")
        self.stdout.write(f"  College location update -- {mode}")
        self.stdout.write(f"{sep}\n")

        updated = 0
        not_found = []

        for name, new_location in ADDRESS_MAP.items():
            try:
                college = College.objects.get(name=name)
            except College.DoesNotExist:
                not_found.append(name)
                self.stdout.write(
                    self.style.WARNING(f"  [!] NOT FOUND : {name}")
                )
                continue

            old = college.location
            if old == new_location:
                self.stdout.write(f"  [=] unchanged : {name}")
                continue

            action = "updated" if apply else "would update"
            self.stdout.write(
                f"  [+] {action:<12}: {name}\n"
                f"       was : {old!r}\n"
                f"       now : {new_location!r}"
            )

            if apply:
                college.location = new_location
                college.save(update_fields=["location"])

            updated += 1

        self.stdout.write(f"\n{sep}")
        if apply:
            self.stdout.write(
                self.style.SUCCESS(
                    f"  Done. {updated} college(s) updated."
                    + (f"  {len(not_found)} not found in DB." if not_found else "")
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"  Dry-run: {updated} would be updated. "
                    "Run with --apply to commit."
                    + (f"  {len(not_found)} not found." if not_found else "")
                )
            )
        self.stdout.write(f"{sep}\n")
