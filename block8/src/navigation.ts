const keys = ['q', 'sort', 'page', 'category', 'minPrice', 'maxPrice', 'available'] as const;
export type ListState = Record<string, string>;
export function listState(raw: Record<string, unknown>): ListState {
  const state: ListState = {};
  for (const key of keys) {
    if (raw[key] !== undefined && typeof raw[key] !== 'string') {
      // Keep malformed queries invalid rather than silently executing a broader query.
      state[key] = '\u0000';
    } else if (typeof raw[key] === 'string') state[key] = raw[key].trim();
  }
  if (!/^[1-9]\d*$/.test(state.page ?? '') || Number(state.page) > 2147483647) state.page = '1';
  return state;
}
export function listUrl(path: string, state: ListState, changes: ListState = {}) {
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = { ...state, ...changes }[key];
    if (value && !(key === 'page' && value === '1')) params.set(key, value);
  }
  return path + (params.size ? '?' + params.toString() : '') + (path === '/dishes' ? '#menu' : '');
}
