import { ApiError } from './errors';
import { requestHeaders } from './headers';
import { responseData } from './validation';
import { jsonRequest } from './transport';
import { getAccessToken, ensureCsrf, refreshAccess, clearAuth } from '../auth/state';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const send = async () => {
    const headers = requestHeaders(options);
    const token = getAccessToken();
    const protectedRequest = /^\/(chefs|ingredients)(\/|\?|$)/.test(path) || !['GET','HEAD','OPTIONS'].includes((options.method ?? 'GET').toUpperCase());
    if (token && protectedRequest) headers.set('Authorization', 'Bearer ' + token);
    if (!['GET', 'HEAD', 'OPTIONS'].includes((options.method ?? 'GET').toUpperCase())) headers.set('X-CSRF-Token', await ensureCsrf());
    return responseData(path, options.method, await jsonRequest(path, { ...options, headers })) as T;
  };
  const originalToken = getAccessToken();
  try { return await send(); }
  catch (error) {
    if (error instanceof ApiError && error.code === 'ACCESS_EXPIRED') {
      if (!getAccessToken()) throw error;
      if (getAccessToken() === originalToken) await refreshAccess();
      options.signal?.throwIfAborted();
      const retryToken = getAccessToken();
      try { return await send(); }
      catch (retryError) { if (retryError instanceof ApiError && retryError.status === 401 && getAccessToken() === retryToken) clearAuth(); throw retryError; }
    }
    if (error instanceof ApiError && error.status === 401 && getAccessToken() === originalToken) clearAuth();
    throw error;
  }
}
