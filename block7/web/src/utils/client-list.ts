/** Literal name matching for the small, fully loaded lookup collections. */
export const normalizeName = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').replace(/đ/g, 'd');

const names = new Intl.Collator('vi', { sensitivity: 'base' });
export function filterClientRows<T extends { id: number; name: string }>(rows: readonly T[], q: string, sort = ''): T[] {
  const term = normalizeName(q.trim());
  return rows.filter(row => normalizeName(row.name).includes(term)).sort((a, b) => {
    const order = sort === 'name-asc' || sort === 'name-desc'
      ? names.compare(normalizeName(a.name), normalizeName(b.name)) : 0;
    return (sort === 'name-desc' ? -order : order) || a.id - b.id;
  });
}
