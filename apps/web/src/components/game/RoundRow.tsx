import { Link } from 'react-router-dom';
import type { Round } from '@parc-ferme/shared';
import { localDateTime } from '../../lib/time';

const STATUS: Record<Round['status'], { label: string; cls: string }> = {
  open: { label: 'OPEN', cls: 'text-neon-green' },
  locked: { label: 'LOCKED', cls: 'text-neon-red' },
  scored: { label: 'SCORED', cls: 'text-neon-yellow' },
};

/** One line of the season calendar. Goes inside <ul className="divide-y-2 divide-line">. */
export function RoundRow({ index, round, to }: { index: number; round: Round; to: string }) {
  return (
    <li>
      <Link to={to} className="grid min-h-[52px] grid-cols-[36px_1fr_auto_auto] items-center gap-2 py-2 text-ink no-underline hover:text-neon-yellow">
        <span className="text-dim">R{String(index).padStart(2, '0')}</span>
        <span className="min-w-0">
          <span className="block truncate">{round.name.toUpperCase()}</span>
          <span className="text-term-small block text-dim">{localDateTime(round.lockAt)}</span>
        </span>
        <span className={`font-pixel text-pixel-micro leading-normal ${STATUS[round.status].cls}`}>{STATUS[round.status].label}</span>
        <span aria-hidden className="font-pixel text-pixel-micro text-dim">
          {'>'}
        </span>
      </Link>
    </li>
  );
}
