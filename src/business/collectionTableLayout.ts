/** Identical identity/contact columns for production and market collection ledgers. */
export function collectionColumnWidths(detailColumnCount: number): number[] {
  return [
    60,
    110,
    280,
    260,
    120,
    220,
    240,
    140,
    120,
    120,
    160,
    160,
    140,
    140,
    ...Array.from({ length: detailColumnCount }, () => 160),
    260,
  ];
}
