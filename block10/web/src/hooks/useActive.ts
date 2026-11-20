import { useEffect, useRef } from 'react';

/** Ignore a completed mutation's UI effects after its page has been left. */
export function useActive() {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  return active;
}
