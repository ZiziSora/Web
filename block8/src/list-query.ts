import { InputError, type Resource } from './domain.js';

export type SearchMode = 'basic' | 'advanced' | 'fulltext' | 'fuzzy';
export interface ListQuery {
  page: number;
  pageSize: number;
  q: string;
  mode: SearchMode;
  fallback: boolean;
  sort: 'id' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc';
  category?: string;
  minPrice?: string;
  maxPrice?: string;
  available?: boolean;
}
export interface Page<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number; pages: number; effectiveMode: SearchMode };
}
export interface Option { id: number; name: string; unit?: string; specialty?: string }
export interface OptionsQuery { q: string; after: number; limit: number }
export interface OptionsPage { items: Option[]; nextCursor: number | null; hasMore: boolean }

export function parseListQuery(resource: Resource, raw: Record<string, unknown>): ListQuery {
  const invalid = (message: string): never => { throw new InputError({ form: message }); };
  if (Object.keys(raw).some(key => !['page', 'pageSize', 'q', 'mode', 'fallback', 'sort', 'category', 'minPrice', 'maxPrice', 'available'].includes(key))) invalid('Điều kiện truy vấn không được hỗ trợ.');
  const value = (key: string, fallback = '') => {
    if (raw[key] === undefined) return fallback;
    if (typeof raw[key] !== 'string') return invalid('Điều kiện truy vấn không hợp lệ.');
    return (raw[key] as string).trim();
  };
  const integer = (key: string, fallback: number, maximum: number) => {
    const text = value(key, String(fallback));
    if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) > maximum)
      return invalid(`${key} không hợp lệ.`);
    return Number(text);
  };
  const q = value('q');
  if (q.length > 200) invalid('Từ khóa tối đa 200 ký tự.');
  const mode = value('mode', 'basic') as SearchMode;
  if (!['basic', 'advanced', 'fulltext', 'fuzzy'].includes(mode) || (resource !== 'dishes' && !['basic', 'advanced'].includes(mode)))
    invalid('Cách tìm kiếm không được hỗ trợ.');
  const sort = value('sort', 'id') as ListQuery['sort'];
  if (!['id', 'name-asc', 'name-desc', ...(resource === 'dishes' ? ['price-asc', 'price-desc'] : [])].includes(sort))
    invalid('Thứ tự sắp xếp không hợp lệ.');
  const fallback = value('fallback');
  if (fallback && (fallback !== 'fuzzy' || mode !== 'fulltext')) invalid('Gợi ý tìm kiếm không hợp lệ.');
  const result: ListQuery = { page: integer('page', 1, 2147483647), pageSize: integer('pageSize', 6, 50), q, mode, sort, fallback: fallback === 'fuzzy' };
  if (resource !== 'dishes') {
    if (['category', 'minPrice', 'maxPrice', 'available'].some(k => raw[k] !== undefined)) invalid('Bộ lọc này chỉ áp dụng cho món ăn.');
    return result;
  }
  const category = value('category');
  if (category.length > 80) invalid('Danh mục tối đa 80 ký tự.');
  if (category) result.category = category;
  for (const key of ['minPrice', 'maxPrice'] as const) {
    const price = value(key);
    if (!price) continue;
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(price)) invalid('Khoảng giá không hợp lệ.');
    result[key] = price;
  }
  if (result.minPrice !== undefined && result.maxPrice !== undefined && Number(result.minPrice) > Number(result.maxPrice)) invalid('Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa.');
  const available = value('available');
  if (available && !['true', 'false'].includes(available)) invalid('Trạng thái phục vụ không hợp lệ.');
  if (available) result.available = available === 'true';
  return result;
}

export function parseOptionsQuery(raw: Record<string, unknown>): OptionsQuery {
  if (Object.keys(raw).some(key => !['q', 'after', 'limit'].includes(key))) throw new InputError({ form: 'Điều kiện lựa chọn không hợp lệ.' });
  const parsed = parseListQuery('chefs', { q: raw.q, pageSize: raw.limit });
  const after = raw.after === undefined ? 0 : Number(raw.after);
  if (raw.after !== undefined && (typeof raw.after !== 'string' || !/^[1-9]\d*$/.test(raw.after) || !Number.isSafeInteger(after) || after > 2147483647))
    throw new InputError({ form: 'Cursor không hợp lệ.' });
  return { q: parsed.q, after, limit: parsed.pageSize };
}
