export interface DeptGroup {
  group: string;
  level: string;
  items: string[];
}

export const DEPARTMENT_GROUPS: DeptGroup[] = [
  {
    group: "Pre-Clinical",
    level: "MBBS / MD",
    items: ["Anatomy", "Biochemistry", "Physiology"],
  },
  {
    group: "Para-Clinical",
    level: "MBBS / MD",
    items: [
      "Community Medicine (PSM)",
      "Forensic Medicine & Toxicology",
      "Microbiology",
      "Pathology",
      "Pharmacology",
    ],
  },
  {
    group: "Clinical: MD / DNB",
    level: "MBBS / MD",
    items: [
      "Anaesthesiology",
      "Dermatology, Venereology & Leprosy (DVL)",
      "Emergency Medicine",
      "General Medicine",
      "Paediatrics",
      "Psychiatry",
      "Radiology / Radiodiagnosis",
      "Respiratory Medicine",
    ],
  },
  {
    group: "Clinical: MS / DNB",
    level: "MBBS / MS",
    items: [
      "ENT (Otorhinolaryngology)",
      "General Surgery",
      "Obstetrics & Gynaecology",
      "Ophthalmology",
      "Orthopaedics",
    ],
  },
  {
    group: "Super-Specialty: DM",
    level: "DM / DrNB",
    items: [
      "Cardiology",
      "Critical Care Medicine",
      "Endocrinology",
      "Gastroenterology",
      "Medical Oncology",
      "Neonatology",
      "Nephrology",
      "Neurology",
      "Rheumatology",
    ],
  },
  {
    group: "Super-Specialty: MCh",
    level: "MCh / DrNB",
    items: [
      "Cardiovascular & Thoracic Surgery (CTVS)",
      "Neurosurgery",
      "Paediatric Surgery",
      "Plastic & Reconstructive Surgery",
      "Surgical Gastroenterology",
      "Surgical Oncology",
      "Urology",
    ],
  },
];

/** Flat list of all department names for filtering / display */
export const ALL_DEPARTMENTS: string[] = DEPARTMENT_GROUPS.flatMap((g) => g.items);
