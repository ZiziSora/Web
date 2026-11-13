import { useEffect, useRef } from 'react';

/** Activate the actual pagination links so keyboard and pointer share routing/animation. */
export function usePageKeys() {
  const previousRef = useRef<HTMLAnchorElement>(null);
  const nextRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const editing = event.composedPath().some(target => target instanceof HTMLElement && (
        target.isContentEditable || target.matches('input, textarea, select, [role="textbox"], [role="slider"], [role="spinbutton"], [role="combobox"]')
      ));
      if (editing) return;
      const link = event.key === 'ArrowLeft' ? previousRef.current : nextRef.current;
      if (!link || link.getAttribute('aria-disabled') === 'true') return;
      event.preventDefault();
      link.click();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return { previousRef, nextRef };
}
