import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Portals keep action hints visible inside scrolling tables. */
export function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean } | null>(null);
  function show() {
    clearTimeout(timer.current);
    const box = anchor.current?.getBoundingClientRect();
    if (!box) return;
    const half = Math.min(130, (innerWidth - 24) / 2);
    const above = box.bottom + 64 > innerHeight;
    setPosition({ left: Math.max(half + 12, Math.min(innerWidth - half - 12, box.x + box.width / 2)), top: above ? box.top - 8 : box.bottom + 8, above });
  }
  function hide() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!anchor.current?.contains(document.activeElement)) setPosition(null);
    }, 100);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!position) return;
    const dismiss = () => setPosition(null);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [position]);
  return <span className="action-tooltip" ref={anchor} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setPosition(null);
  }}>
    {children}
    {position && createPortal(<span role="tooltip" className={'action-tooltip-bubble' + (position.above ? ' above' : '')}
      style={{ left: position.left, top: position.top }} onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={hide}>{label}</span>, document.body)}
  </span>;
}
