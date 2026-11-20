import { useEffect, useSyncExternalStore } from 'react';
import { authState, bootstrapAuth } from './state';
export function useAuth() {
  const state = useSyncExternalStore(authState.subscribe, authState.getSnapshot);
  useEffect(() => { void bootstrapAuth(); }, []);
  return state;
}
