import { ApiError } from './errors';
import { requestHeaders } from './headers';
export const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3009/api';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export async function jsonRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  let res: Response;
  try { res = await fetch(base + path, { ...options, credentials: 'include', headers: requestHeaders(options) }); }
  catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError('Không kết nối được API. Vui lòng thử lại.');
  }
  let body: unknown;
  try { body = await res.json(); } catch { throw new ApiError('Phản hồi máy chủ không hợp lệ.'); }
  // Existing CRUD errors carry relation details; their stricter DTO validator
  // handles them. Auth errors need their HTTP status and refresh metadata.
  if (object(body) && body.ok === false && object(body.error)
    && (path.startsWith('/auth') || !['NOT_FOUND', 'VALIDATION_FAILED'].includes(String(body.error.code)))) {
    const e = body.error;
    if (typeof e.code !== 'string' || typeof e.message !== 'string'
      || (e.fields !== undefined && (!object(e.fields) || !Object.values(e.fields).every(v => typeof v === 'string')))) throw new ApiError('Phản hồi máy chủ không hợp lệ.');
    const seconds = e.retryAfter ?? Number(res.headers.get('Retry-After') ?? 0);
    throw new ApiError(e.message, e.code, e.fields as Record<string, string> | undefined, [], res.status,
      typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0 ? seconds : 0, e.captchaRequired === true);
  }
  if (!res.ok) throw new ApiError('Máy chủ chưa thể xử lý yêu cầu. Vui lòng thử lại.', 'TECHNICAL', {}, [], res.status);
  return body;
}
export async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = await jsonRequest('/auth' + path, options);
  if (!object(body) || body.ok !== true || !('data' in body)) throw new ApiError('Phản hồi máy chủ không hợp lệ.');
  return body.data as T;
}
