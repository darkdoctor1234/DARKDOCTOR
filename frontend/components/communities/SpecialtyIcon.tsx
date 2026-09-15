"use client";

/**
 * Line-icon set for PG departments, matching the app's existing icon language
 * (stroke-based, ~1.8–2px, currentColor) instead of emoji — see
 * [[feedback-working-style]]: emoji-as-icon reads as AI-generated. Keyed by
 * department NAME (the fixed list in lib/departments.ts / the backend's
 * PG_DEPARTMENT_CHOICES) via keyword match, not every one of the ~35
 * departments has a bespoke icon — anything unmatched (Anatomy, Pathology,
 * Pharmacology, etc.) falls back to a generic medical-cross icon, which is a
 * fine default, not a gap to fill.
 */
export default function SpecialtyIcon({ department, size = 16 }: { department: string; size?: number }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const,
    stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };

  const d = department.toLowerCase();
  const has = (...kws: string[]) => kws.some((k) => d.includes(k));

  if (has("general medicine"))
    return (
      <svg {...common}>
        <path d="M7 3v6a4 4 0 008 0V3" />
        <path d="M11 13v2a5 5 0 0010 0v-2.5" />
        <circle cx="21" cy="10.5" r="1.6" />
      </svg>
    );
  if (has("cardio"))
    return (
      <svg {...common}>
        <path d="M12 20.5S3 14.7 3 8.6A4.6 4.6 0 0112 6.2 4.6 4.6 0 0121 8.6c0 6.1-9 11.9-9 11.9z" />
      </svg>
    );
  if (has("radio"))
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
      </svg>
    );
  if (has("ortho"))
    return (
      <svg {...common}>
        <path d="M6.5 6.5a2.2 2.2 0 10-3.1 3.1L14.4 20.6a2.2 2.2 0 103.1-3.1zM17.5 6.5a2.2 2.2 0 113.1 3.1L9.6 20.6a2.2 2.2 0 11-3.1-3.1z" />
      </svg>
    );
  if (has("paediatric", "pediatric", "neonat"))
    return (
      <svg {...common}>
        <rect x="9" y="8" width="6" height="13" rx="2" />
        <path d="M10 8V5a2 2 0 014 0v3" />
        <path d="M9 12.5h6" />
      </svg>
    );
  if (has("surg"))
    return (
      <svg {...common}>
        <path d="M4 20L14 10" />
        <path d="M14 10l3.5-3.5a2 2 0 112.83 2.83L16.8 12.8" />
        <path d="M4 20l2.5-1 .5-2.5" />
      </svg>
    );
  if (has("psychiatry", "neuro"))
    return (
      <svg {...common}>
        <path d="M9 4.5a3 3 0 00-3 3v.3A3.2 3.2 0 004 10.7a3.2 3.2 0 001.3 5.6A3 3 0 008 20a3 3 0 001-.2" />
        <path d="M15 4.5a3 3 0 013 3v.3a3.2 3.2 0 012 3.9 3.2 3.2 0 01-1.3 5.6A3 3 0 0116 20a3 3 0 01-1-.2" />
        <path d="M9 4.5a3 3 0 016 0V18a3 3 0 01-3 3 3 3 0 01-3-3z" />
      </svg>
    );
  if (has("dermatology"))
    return (
      <svg {...common}>
        <path d="M12 3s6.5 7.2 6.5 11.5a6.5 6.5 0 01-13 0C5.5 10.2 12 3 12 3z" />
      </svg>
    );
  if (has("obstetric", "gynaecolog", "gynecolog"))
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M7 12h2.5l1.3-3.2L13 15l1.3-3h2.7" />
      </svg>
    );
  if (has("emergency", "critical care"))
    return (
      <svg {...common}>
        <path d="M12 3l7 3v5.5c0 4.7-3 8.4-7 9.5-4-1.1-7-4.8-7-9.5V6z" />
        <path d="M12 8.5v6M9 11.5h6" />
      </svg>
    );

  // generic medical cross — fallback for every other department
  return (
    <svg {...common}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
