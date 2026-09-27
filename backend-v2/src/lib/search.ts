/**
 * Case-insensitive search that works for non-ASCII text. D1's SQLite folds
 * only ASCII in LIKE/lower() and loads no ICU, so entries also store folded
 * copies of their searchable text (`*_folded`), computed here on every write,
 * and searches compare folded text to a folded term. Django got the same
 * effect from Postgres's Unicode-aware UPPER() in `icontains`.
 */
export function fold(text: string): string {
  return text.toLowerCase();
}

/** The folded columns for an entry's searchable fields. */
export function searchColumns(entry: {subject: string; body: string}): {
  subject_folded: string;
  body_folded: string;
} {
  return {subject_folded: fold(entry.subject), body_folded: fold(entry.body)};
}
