/**
 * Multi-word, order-independent search match.
 *
 * A plain `haystack.includes(query)` only matches when the query's words
 * appear in the exact same order as the source text — "Visakhapatnam
 * Medical" then fails to match "Andhra Medical College, Visakhapatnam"
 * even though every word is genuinely present. Splitting the query into
 * tokens and requiring each one to appear somewhere in the combined
 * fields (independently, any order) fixes that.
 */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}
