export const PAGE_SIZE = 10;

export function pageCount(length) {
  return Math.max(1, Math.ceil(length / PAGE_SIZE));
}

export function pageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page++) pages.add(page);
  if (current <= 3) [2, 3, 4].forEach(page => pages.add(page));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach(page => pages.add(page));
  const result = [];
  for (const page of [...pages].sort((a, b) => a - b)) {
    const previous = result.at(-1);
    if (typeof previous === 'number' && page - previous > 1) result.push(`gap-${page}`);
    result.push(page);
  }
  return result;
}
