import { useEffect,useState } from 'react';
import { ApiError } from '../api';

export function useLoad<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, set] = useState<{ key: string; data?: T; error?: ApiError; loading: boolean }>({ key, loading: true });
  const [attempt, bump] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    set({ key, loading: true });
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) set({ key, data, loading: false });
    }).catch(error => {
      if (!controller.signal.aborted) set({ key, error: error instanceof ApiError ? error : new ApiError('Vui lòng thử lại sau.'), loading: false });
    });
    return () => controller.abort();
  }, [key, attempt]);
  return { ...(state.key === key ? state : { key, data: undefined, error: undefined, loading: true }), retry: () => bump(x => x + 1) };
}
