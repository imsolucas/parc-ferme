import type { ReactNode } from 'react';

interface Props {
  title?: string;
  /** Tailwind text colour class for the title, e.g. "text-neon-cyan". */
  accent?: string;
  action?: ReactNode;
  /** Tighter side padding on a phone. For PicksTable only. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

/** Bordered timing-screen panel with an optional pixel heading. */
export function Panel({ title, accent = 'text-neon-cyan', action, flush, className = '', children }: Props) {
  return (
    <section className={`border-4 border-line bg-panel ${flush ? 'px-2 pt-4 pb-2 @min-[640px]/shell:p-4' : 'p-4'} ${className}`}>
      {(title || action) && (
        <header className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${flush ? 'px-2 @min-[640px]/shell:px-0' : ''}`}>
          {title && <h2 className={`text-pixel-title ${accent}`}>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
