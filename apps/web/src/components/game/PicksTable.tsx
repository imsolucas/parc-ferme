import {
  CATEGORIES,
  CATEGORY_LABELS,
  CHAOS_LABELS,
  MAX_ROUND_POINTS,
  POINTS,
  type Category,
  type ChaosCall,
  type Driver,
  type PlayerRound,
  type RoundResults,
} from '@parc-ferme/shared';
import { Notice } from '../ui/Notice';
import { DriverTag } from './DriverTag';

interface Props {
  players: PlayerRound[];
  results: RoundResults | null;
  drivers: Map<number, Driver>;
  meId?: string;
}

const HEADS: Record<Category, string> = { pole: 'POL', p1: 'P1', p2: 'P2', p3: 'P3', fastest_lap: 'FL', first_dnf: 'DNF', chaos: 'CHS' };
/** Short chaos codes: the full label cannot fit a 34px cell. */
const CHAOS_CODES: Record<ChaosCall, string> = { SAFETY_CAR: 'SC', RED_FLAG: 'RF', VSC: 'VSC', LAP1_INCIDENT: 'L1', NO_SC: 'NO' };

type CellState = 'hit' | 'part' | 'miss' | 'pending';
const cellState = (cat: Category, pts: number | null): CellState => {
  if (pts === null) return 'pending';
  if (pts === 0) return 'miss';
  if ((cat === 'p1' || cat === 'p2' || cat === 'p3') && pts < POINTS.podiumExact) return 'part';
  return 'hit';
};
const FILL: Record<CellState, string> = {
  hit: 'bg-wash-hit',
  part: 'bg-wash-part',
  miss: 'bg-wash-miss',
  pending: 'bg-void shadow-[inset_0_0_0_2px_var(--color-line)]',
};
const PTS: Record<CellState, string> = { hit: 'text-neon-green', part: 'text-neon-yellow', miss: 'text-neon-red', pending: 'text-dim' };
const WORDS: Record<CellState, string> = { hit: 'hit', part: 'right driver, wrong position', miss: 'miss', pending: 'pending' };
const ptsText = (pts: number | null) => (pts === null ? '--' : pts > 0 ? `+${pts}` : '0');

const pickNumber = (p: PlayerRound, cat: Exclude<Category, 'chaos'>) =>
  ({ pole: p.picks.pole, p1: p.picks.p1, p2: p.picks.p2, p3: p.picks.p3, fastest_lap: p.picks.fastestLap, first_dnf: p.picks.firstDnf })[cat];

function resultNumbers(r: RoundResults | null, cat: Exclude<Category, 'chaos'>): number[] | null {
  if (!r) return null;
  switch (cat) {
    case 'pole':
      return r.pole === null ? null : [r.pole];
    case 'p1':
    case 'p2':
    case 'p3':
      return r.podium ? [r.podium[Number(cat[1]) - 1]!] : null;
    case 'fastest_lap':
      return r.fastestLap;
    case 'first_dnf':
      return r.firstDnf;
  }
}

const TH = 'font-pixel text-pixel-micro py-1 text-center font-normal leading-normal @min-[640px]/shell:text-pixel-label';
const CELL_IN = 'flex flex-col items-center justify-center gap-px @min-[640px]/shell:flex-row @min-[640px]/shell:gap-2';
const CODE = 'text-term-small leading-none @min-[640px]/shell:text-term-body';
const POINTS_CLS = 'font-pixel text-pixel-micro leading-normal';

/** One cell: the pick, its points, and a fill that says hit, wrong spot, miss or pending. */
function PicksCell({ cat, player, drivers }: { cat: Category; player: PlayerRound; drivers: Map<number, Driver> }) {
  const pts = player.breakdown[cat];
  const state = cellState(cat, pts);
  const n = cat === 'chaos' ? null : pickNumber(player, cat);
  const spoken = cat === 'chaos' ? CHAOS_LABELS[player.picks.chaos] : (drivers.get(n!)?.fullName ?? `#${n}`);
  return (
    <td className={`h-11 p-0 text-center align-middle ${FILL[state]}`} aria-label={`${CATEGORY_LABELS[cat]}: ${spoken}, ${WORDS[state]}, ${ptsText(pts)}`}>
      <span className={CELL_IN}>
        {cat === 'chaos' ? (
          <abbr className={`${CODE} no-underline`} title={CHAOS_LABELS[player.picks.chaos]}>
            {CHAOS_CODES[player.picks.chaos]}
          </abbr>
        ) : (
          <DriverTag compact className={CODE} number={n} driver={drivers.get(n!)} />
        )}
        <span className={`${POINTS_CLS} ${PTS[state]}`}>{ptsText(pts)}</span>
      </span>
    </td>
  );
}

const RESULT_CELL = 'h-11 bg-panel p-0 text-center align-middle shadow-[inset_0_-2px_0_var(--color-neon-yellow)]';

/** Timing-screen grid: one row per player, one column per category, the result on top. Fits 10 players at 390px. */
export function PicksTable({ players, results, drivers, meId }: Props) {
  if (players.length === 0) return <Notice>NOBODY MADE PICKS FOR THIS ROUND.</Notice>;
  return (
    <div>
      <table className="w-full table-fixed border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th scope="col" className="w-9 @min-[640px]/shell:w-[52px]">
              <span className="sr-only">Player</span>
            </th>
            {CATEGORIES.map((cat) => (
              <th key={cat} scope="col" className={`${TH} text-dim`}>
                <abbr className="no-underline" title={CATEGORY_LABELS[cat]}>
                  {HEADS[cat]}
                </abbr>
              </th>
            ))}
            <th scope="col" className={`${TH} w-[34px] text-dim @min-[640px]/shell:w-[52px]`}>
              <abbr className="no-underline" title="Total points">
                TOT
              </abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className={`${TH} text-left text-neon-yellow`}>
              <abbr className="no-underline" title="Result">
                RES
              </abbr>
            </th>
            {CATEGORIES.map((cat) => (
              <td key={cat} className={RESULT_CELL}>
                <span className={CELL_IN}>
                  {cat === 'chaos' ? (
                    results?.chaos ? (
                      results.chaos.length === 0 ? (
                        <span className={`${CODE} text-dim`}>NONE</span>
                      ) : (
                        results.chaos.map((c) => (
                          <abbr key={c} className={`${CODE} no-underline`} title={CHAOS_LABELS[c]}>
                            {CHAOS_CODES[c]}
                          </abbr>
                        ))
                      )
                    ) : (
                      <span className={`${CODE} text-dim`}>--</span>
                    )
                  ) : (
                    (() => {
                      const ns = resultNumbers(results, cat);
                      if (!ns) return <span className={`${CODE} text-dim`}>--</span>;
                      if (ns.length === 0) return <span className={`${CODE} text-dim`}>NONE</span>;
                      return ns.slice(0, 3).map((n) => <DriverTag key={n} compact className={CODE} number={n} driver={drivers.get(n)} />);
                    })()
                  )}
                </span>
              </td>
            ))}
            <td className={RESULT_CELL}>
              <span className={`${POINTS_CLS} text-dim`}>/{MAX_ROUND_POINTS}</span>
            </td>
          </tr>
          {players.map((p) => {
            const pending = CATEGORIES.every((c) => p.breakdown[c] === null);
            return (
              <tr key={p.userId}>
                <th scope="row" title={p.displayName} className={`${TH} text-left ${p.userId === meId ? 'text-neon-cyan' : 'text-ink'}`}>
                  {p.initials}
                </th>
                {CATEGORIES.map((cat) => (
                  <PicksCell key={cat} cat={cat} player={p} drivers={drivers} />
                ))}
                <td className="font-pixel text-pixel-title h-11 bg-panel p-0 text-center align-middle leading-normal text-neon-green tabular-nums @min-[640px]/shell:text-pixel-score">
                  {pending ? '--' : String(p.total).padStart(2, '0')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul aria-label="Legend" className="text-term-small mt-3 flex flex-wrap gap-x-3 gap-y-1 px-1 text-dim">
        <li className="inline-flex items-center gap-1.5">
          <i className="inline-block size-3 bg-wash-hit" />
          HIT
        </li>
        <li className="inline-flex items-center gap-1.5">
          <i className="inline-block size-3 bg-wash-part" />
          +2 WRONG SPOT
        </li>
        <li className="inline-flex items-center gap-1.5">
          <i className="inline-block size-3 bg-wash-miss" />0 MISS
        </li>
        <li className="inline-flex items-center gap-1.5">
          <i className={`inline-block size-3 ${FILL.pending}`} />
          -- PENDING
        </li>
        <li className="basis-full">CHS: SC SAFETY CAR · RF RED FLAG · VSC VIRTUAL SC · L1 LAP 1 INCIDENT · NO NO SC / VSC</li>
      </ul>
    </div>
  );
}
