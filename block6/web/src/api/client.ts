import { ApiError } from './errors';
import { requestHeaders } from './headers';
import { validateData } from './validation';
const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3006/api';
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${base}${path}`, { ...options, headers: requestHeaders(options) });
    }
    catch (e) {
        if ((e as Error).name === 'AbortError')
            throw e;
        throw new ApiError('Không kết nối được API. Vui lòng thử lại.');
    }
    if (!res.ok)
        throw new ApiError('Máy chủ chưa thể xử lý yêu cầu. Vui lòng thử lại.');
    let body;
    try {
        body = await res.json();
    }
    catch {
        throw new ApiError('Phản hồi máy chủ không hợp lệ.');
    }
    if (body?.ok === false && typeof body.error?.code === 'string')
        throw new ApiError(body.error.message, body.error.code, body.error.fields ?? {}, body.error.details?.dishes ?? []);
    if (body?.ok !== true || !('data' in body))
        throw new ApiError('Phản hồi máy chủ không hợp lệ.');
    validateData(path, options.method, body.data);
    return body.data;
}
