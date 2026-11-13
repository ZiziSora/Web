import { authRequest } from '../api/transport';
import { ApiError } from '../api/errors';

export interface AuthUser { id: string; email: string; role: string }
type Snapshot = { status: 'loading' | 'anonymous' | 'authenticated' | 'error'; user: AuthUser | null; error: ApiError | null };
let snapshot: Snapshot = { status: 'loading', user: null, error: null };
let accessToken = '', csrfToken = '', generation = 0;
let bootstrapPromise: Promise<void> | null = null, csrfPromise: Promise<string> | null = null, refreshPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();
const channel = typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('block9.auth') : null;
const update = (value: Snapshot) => { snapshot = value; listeners.forEach(fn => fn()); };
export const authState = { subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, getSnapshot: () => snapshot };
export const getAccessToken = () => accessToken;
export function clearAuth(broadcast = false) {
  generation++; accessToken = '';
  update({ status: 'anonymous', user: null, error: null });
  if (broadcast) channel?.postMessage({ type: 'logout' });
}
channel?.addEventListener('message', event => { if (event.data?.type === 'logout') clearAuth(); });
export async function withAuthLock<T>(work: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new ApiError('Trình duyệt cần hỗ trợ Web Locks để đăng nhập an toàn.');
  return navigator.locks.request('block9.auth.cookie', work);
}
async function csrfUnlocked() {
  if (csrfToken) return csrfToken;
  const data = await authRequest<{ csrfToken: string }>('/csrf');
  if (!data || typeof data.csrfToken !== 'string' || !data.csrfToken) throw new ApiError('Phản hồi máy chủ không hợp lệ.');
  csrfToken = data.csrfToken;
  return csrfToken;
}
export function ensureCsrf() {
  if (csrfToken) return Promise.resolve(csrfToken);
  return csrfPromise ??= withAuthLock(csrfUnlocked).finally(() => { csrfPromise = null; });
}
function acceptGrant(data: unknown, epoch: number) {
  const grant = data as { accessToken?: unknown; expiresAt?: unknown; user?: AuthUser } | null;
  if (!grant || typeof grant.accessToken !== 'string' || typeof grant.expiresAt !== 'number'
    || !grant.user || !['id', 'email', 'role'].every(k => typeof grant.user![k as keyof AuthUser] === 'string')) throw new ApiError('Phản hồi máy chủ không hợp lệ.');
  if (epoch !== generation) return;
  accessToken = grant.accessToken;
  update({ status: 'authenticated', user: grant.user, error: null });
}
export function refreshAccess(): Promise<void> {
  return refreshPromise ??= withAuthLock(async () => {
    const epoch = generation;
    const csrf = await csrfUnlocked();
    try {
      const grant = await authRequest('/refresh', { method: 'POST', headers: { 'X-CSRF-Token': csrf } });
      acceptGrant(grant, epoch);
    } catch (error) {
      if (epoch === generation) {
        accessToken = '';
        if (error instanceof ApiError && error.status === 401) clearAuth();
        else update({ status: 'error', user: null, error: error instanceof ApiError ? error : new ApiError('Không thể khôi phục đăng nhập.') });
      }
      throw error;
    }
  }).finally(() => { refreshPromise = null; });
}
export function bootstrapAuth(retry = false) {
  if (retry) { bootstrapPromise = null; csrfToken = ''; }
  return bootstrapPromise ??= (async () => {
    try { await refreshAccess(); }
    catch (error) {
      if (snapshot.status === 'loading') update({ status: 'error', user: null, error: error instanceof ApiError ? error : new ApiError('Không thể khôi phục đăng nhập.') });
    }
  })();
}
export async function submitAuth<T>(path: string, values: Record<string, unknown> = {}): Promise<T> {
  const csrf = await ensureCsrf();
  return authRequest<T>(path, { method: 'POST', body: JSON.stringify(values), headers: { 'X-CSRF-Token': csrf } });
}
export async function login(values: Record<string, unknown>) {
  await withAuthLock(async () => {
    const epoch = generation;
    const csrf = await csrfUnlocked();
    acceptGrant(await authRequest('/login', { method: 'POST', body: JSON.stringify(values), headers: { 'X-CSRF-Token': csrf } }), epoch);
  });
}
export async function logout() {
  await withAuthLock(async () => {
    const csrf = await csrfUnlocked();
    await authRequest('/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrf } });
    clearAuth(true);
  });
}
