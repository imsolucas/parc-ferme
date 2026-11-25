import type { Driver } from '@parc-ferme/shared';

interface Props {
  driver?: Driver;
  number?: number | null;
  /** Narrow 3px bar for a phone PicksTable cell. */
  compact?: boolean;
  className?: string;
}

/** Three-letter driver code with the team colour bar, as on a timing tower. */
export function DriverTag({ driver, number, compact, className = '' }: Props) {
  if (number === null || number === undefined) return <span className={`text-dim ${className}`}>---</span>;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap ${compact ? 'gap-[3px] @min-[640px]/shell:gap-1.5' : 'gap-2'} ${className}`}
      title={driver ? `${driver.fullName} (${driver.team})` : undefined}
    >
      <span
        aria-hidden
        className={`inline-block shrink-0 ${compact ? 'h-3 w-[3px] @min-[640px]/shell:h-4 @min-[640px]/shell:w-1.5' : 'h-[0.8em] w-1.5'}`}
        style={{ background: `#${driver?.colour ?? 'ffffff'}` }}
      />
      {driver?.acronym ?? `#${number}`}
    </span>
  );
}
