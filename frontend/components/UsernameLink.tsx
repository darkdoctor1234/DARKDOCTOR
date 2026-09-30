"use client";

import { useRouter } from "next/navigation";

/** Clicking a username opens that user's public profile (username, college,
 * their own Q&A activity — never reviews, which stay anonymous everywhere). */
export default function UsernameLink({ name, size = "0.875rem", color = "var(--dd-text1)" }: { name: string; size?: string; color?: string }) {
  const router = useRouter();
  if (!name || name === "Anonymous" || name === "Doctor") {
    return <span style={{ fontSize: size, fontWeight: 600, color }}>{name}</span>;
  }
  return (
    <span
      onClick={(e) => { e.stopPropagation(); router.push(`/u/${encodeURIComponent(name)}`); }}
      style={{ fontSize: size, fontWeight: 600, color, cursor: "pointer" }}
      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
    >
      {name}
    </span>
  );
}
