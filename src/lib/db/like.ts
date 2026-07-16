// Escape LIKE/ILIKE metacharacters so user-supplied search text matches
// literally — a search for "50%" or "a_b" shouldn't turn into a wildcard
// pattern. Backslash is escaped first so the escapes we add aren't
// double-escaped. Pair with ILIKE's default ESCAPE '\'.
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, char => `\\${char}`);
}
