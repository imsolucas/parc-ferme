import type { ReactNode } from 'react';

/** Blinking attract-mode text ("INSERT COIN"). */
export function Blink({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`animate-blink ${className}`}>{children}</span>;
}
