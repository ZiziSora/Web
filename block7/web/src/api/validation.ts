import { ApiError } from './errors';
import type { Entity } from '../types/api';

type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const link = (value: unknown): value is JsonObject => object(value) && Number.isInteger(value.id) && Number(value.id) > 0 && Number(value.id) <= 2147483647 && typeof value.name === 'string';
const malformed = () => new ApiError('Phản hồi máy chủ không hợp lệ.');

export function validateData(path: string, method: string | undefined, data: unknown) {
  const parts = path.split('?')[0].split('/').filter(Boolean);
  const verb = (method ?? 'GET').toUpperCase();
  const entity = (value: unknown): boolean => {
    if (!link(value)) return false;
    if (parts[0] === 'dishes') {
      return typeof value.description === 'string' && typeof value.price === 'string'
        && /^\d{1,10}(\.\d{1,2})?$/.test(value.price)
        && typeof value.category === 'string' && typeof value.available === 'boolean'
        && Array.isArray(value.chefs) && value.chefs.every(c => link(c) && typeof c.specialty === 'string')
        && Array.isArray(value.ingredients) && value.ingredients.every(i => link(i) && typeof i.unit === 'string');
    }
    return ['chefs', 'ingredients'].includes(parts[0])
      && Array.isArray(value.dishes) && value.dishes.every(link)
      && typeof value[parts[0] === 'chefs' ? 'specialty' : 'unit'] === 'string';
  };
  if (verb === 'GET' && parts[1] === 'facets') {
    if (!object(data) || !Array.isArray(data.categories) || !data.categories.every(c => typeof c === 'string')) throw malformed();
    return;
  }
  if (verb === 'GET' && parts[1] === 'options') {
    if (!object(data) || !Array.isArray(data.items) || !data.items.every(value => link(value) && typeof value[parts[0] === 'chefs' ? 'specialty' : 'unit'] === 'string')
      || typeof data.hasMore !== 'boolean' || !(data.nextCursor === null || (Number.isInteger(data.nextCursor) && Number(data.nextCursor) > 0))
      || data.hasMore !== (data.nextCursor !== null) || (data.hasMore && (!data.items.length || (data.items.at(-1) as JsonObject).id !== data.nextCursor))) throw malformed();
    return;
  }
  const page = (value: unknown) => {
    if (!object(value) || !Array.isArray(value.items) || !value.items.every(entity) || !object(value.meta)) return false;
    const m = value.meta;
    return ['page', 'pageSize', 'pages'].every(k => Number.isSafeInteger(m[k]) && Number(m[k]) > 0)
      && Number(m.pageSize) <= 50 && Number.isSafeInteger(m.total) && Number(m.total) >= 0
      && m.pages === Math.max(1, Math.ceil(Number(m.total) / Number(m.pageSize))) && Number(m.page) <= Number(m.pages)
      && value.items.length === Math.min(Number(m.pageSize), Math.max(0, Number(m.total) - (Number(m.page) - 1) * Number(m.pageSize)))
      && ['basic', 'advanced', 'fulltext', 'fuzzy'].includes(String(m.effectiveMode));
  };
  const valid = verb === 'DELETE' ? data === null
    : verb === 'GET' && parts.length === 1 ? page(data)
    : entity(data);
  if (!valid) throw malformed();
}

/** Validate errors too: malformed API values must never reach JSX as objects. */
export function responseData(path: string, method: string | undefined, body: unknown): unknown {
  if (!object(body)) throw malformed();
  if (body.ok === false) {
    const error = body.error;
    if (!object(error) || !['NOT_FOUND', 'VALIDATION_FAILED'].includes(String(error.code)) || typeof error.message !== 'string') throw malformed();
    if (error.fields !== undefined && (!object(error.fields) || !Object.values(error.fields).every(v => typeof v === 'string'))) throw malformed();
    if (error.details !== undefined && (!object(error.details) || (error.details.dishes !== undefined && (!Array.isArray(error.details.dishes) || !error.details.dishes.every(link))))) throw malformed();
    throw new ApiError(error.message, String(error.code), error.fields as Record<string, string> | undefined, (error.details as { dishes?: Entity[] } | undefined)?.dishes);
  }
  if (body.ok !== true || !('data' in body)) throw malformed();
  validateData(path, method, body.data);
  return body.data;
}
