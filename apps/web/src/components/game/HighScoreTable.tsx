import type { LeaderboardRow } from '@parc-ferme/shared';
import { useCountUp } from '../../lib/hooks';
import { Notice } from '../ui/Notice';

const ORDINALS = ['1ST', '2ND', '3RD'];
const ordinal = (rank: number) => ORDINALS[rank - 1] ?? `${rank}TH`;

function Row({ row, index, me, pending }: { row: LeaderboardRow; index: number; me: boolean; pending: boolean }) {
  const delay = index * 110;
  const score = useCountUp(row.points, 700, delay + 200);
  const colour = me ? 'text-neon-cyan' : 'text-ink';
  // The <li> already runs the slide-in animation, so the 1st-place colour cycle lives on the cells.
  const champ = row.rank === 1 && !pending ? 'animate-champion' : '';
  return (
    <li
      className={`animate-row-in font-pixel text-pixel-title grid grid-cols-[44px_44px_1fr_auto] items-center gap-2 py-2.5 leading-normal @min-[640px]/shell:grid-cols-[64px_64px_1fr_auto] @min-[640px]/shell:text-pixel-score ${colour}`}
      style={{ animationDelay: `${delay}ms` }}
      aria-label={pending ? `${row.displayName}, score pending` : `${ordinal(row.rank)}: ${row.displayName}, ${row.points} points`}
    >
      <span className={champ}>{pending ? '--' : ordinal(row.rank)}</span>
      <span className={champ}>{row.initials}</span>
      <span className="font-term text-term-body truncate leading-[1.15] text-dim uppercase">
        {row.displayName}
        {me && <span className="text-neon-cyan">{' < YOU'}</span>}
      </span>
      <span className={`tabular-nums ${pending ? 'text-dim' : champ}`}>{pending ? '----' : String(score).padStart(4, '0')}</span>
    </li>
  );
}

interface Props {
  rows: LeaderboardRow[];
  meId?: string;
  /** Roster only: -- ranks and ---- scores, before any result is in. */
  pending?: boolean;
}

/** Arcade HIGH SCORE table: rows slide in one by one and the scores roll up. */
export function HighScoreTable({ rows, meId, pending = false }: Props) {
  if (rows.length === 0) return <Notice>NO PLAYERS YET.</Notice>;
  // Re-keying on the standings replays the entrance when ranks change.
  const key = rows.map((r) => `${r.userId}:${r.points}`).join('|');
  return (
    <ol key={key} className="divide-y-2 divide-line">
      {rows.map((row, i) => (
        <Row key={row.userId} row={row} index={i} me={row.userId === meId} pending={pending} />
      ))}
    </ol>
  );
}
