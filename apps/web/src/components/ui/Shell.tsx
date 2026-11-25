import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useToggle } from '../../lib/hooks';
import { CrtOverlay } from './CrtOverlay';
import { CrtToggle } from './CrtToggle';

/**
 * Page frame: marquee header, CRT toggle, content column.
 * The inner box is the query container ("shell"); the one breakpoint is 640px of its width.
 * Fixed layers (CRT overlay, driver sheet) mount on the root, outside the container box.
 */
export function Shell({ children }: { children: ReactNode }) {
  const [crt, toggleCrt] = useToggle('pf.crt', true);
  return (
    <div data-shell className={`relative ${crt ? 'crt-glow' : ''}`}>
      <div data-shell-box className="@container/shell">
        <div className="mx-auto flex min-h-dvh max-w-[800px] flex-col px-4 pb-10">
          <header className="flex items-center justify-between gap-3 border-b-4 border-neon-red py-3">
            <Link
              to="/"
              className="font-pixel text-pixel-score inline-flex min-h-11 items-center leading-normal text-neon-red no-underline @min-[640px]/shell:text-pixel-timer"
            >
              PARC FERMÉ
            </Link>
            <CrtToggle on={crt} onChange={() => toggleCrt()} />
          </header>
          <main className="flex flex-1 flex-col gap-6 pt-6">{children}</main>
        </div>
      </div>
      <CrtOverlay on={crt} />
    </div>
  );
}
