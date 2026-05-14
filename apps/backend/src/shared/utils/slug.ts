/**
 * PL-safe slugification: pre-map non-decomposable Polish letters (Ł/ł),
 * NFD-normalize away combining diacritics, lowercase, replace non-alphanum
 * with hyphens, trim hyphens, cap length.
 * Phase 2 may swap in the `slugify` lib for richer locale handling.
 */
export function slugify(input: string): string {
  const PL_PREMAP: Record<string, string> = {
    'ł': 'l',
    'Ł': 'L',
  };
  const base = input
    .replace(/[łŁ]/g, (ch) => PL_PREMAP[ch] ?? ch)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'wycieczka';
}
