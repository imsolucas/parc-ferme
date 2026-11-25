import { useState, type FormEvent } from 'react';
import { CHAOS_CALLS, POINTS, type ChaosCall, type Driver, type Picks } from '@parc-ferme/shared';
import { ArcadeButton } from '../ui/ArcadeButton';
import { Notice } from '../ui/Notice';
import { ChaosOption } from './ChaosOption';
import { DriverSelect } from './DriverSelect';

type Draft = { [K in keyof Picks]: Picks[K] | null };
type SlotKey = Exclude<keyof Picks, 'chaos'>;
const EMPTY: Draft = { pole: null, p1: null, p2: null, p3: null, fastestLap: null, firstDnf: null, chaos: null };

const SLOTS: { key: SlotKey; label: string; pts: string }[] = [
  { key: 'pole', label: 'POLE', pts: `${POINTS.pole}` },
  { key: 'p1', label: 'P1', pts: `${POINTS.podiumExact}/${POINTS.podiumWrongSpot}` },
  { key: 'p2', label: 'P2', pts: `${POINTS.podiumExact}/${POINTS.podiumWrongSpot}` },
  { key: 'p3', label: 'P3', pts: `${POINTS.podiumExact}/${POINTS.podiumWrongSpot}` },
  { key: 'fastestLap', label: 'FAST LAP', pts: `${POINTS.fastestLap}` },
  { key: 'firstDnf', label: '1ST DNF', pts: `${POINTS.firstDnf}` },
];
const PODIUM = ['p1', 'p2', 'p3'] as const;

interface Props {
  drivers: Driver[];
  initial: Picks | null;
  onSave: (picks: Picks) => Promise<void>;
}

/** Teammates side by side in the picker: group by team, in order of first appearance. */
function byTeam(drivers: Driver[]): Driver[] {
  const order = new Map<string, number>();
  drivers.forEach((d) => {
    if (!order.has(d.team)) order.set(d.team, order.size);
  });
  return [...drivers].sort((a, b) => order.get(a.team)! - order.get(b.team)! || a.number - b.number);
}

/** The pick card: six driver slots and one chaos call. Presentational; saving is the caller's job. */
export function PickForm({ drivers, initial, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(initial ?? EMPTY);
  const [openSlot, setOpenSlot] = useState<SlotKey | null>(null);
  const [state, setState] = useState<{ busy: boolean; error?: string; saved?: boolean }>({ busy: false });
  const filled = Object.values(draft).filter((v) => v !== null).length;
  const complete = filled === 7;
  const grid = byTeam(drivers);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setState({ busy: false });
  };
  // After a pick, the next empty driver slot opens by itself: six taps fill the card.
  const pick = (key: SlotKey, n: number) => {
    const next = { ...draft, [key]: n };
    set(key, n);
    setOpenSlot(SLOTS.find((s) => next[s.key] === null)?.key ?? null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!complete) return;
    setState({ busy: true });
    try {
      await onSave(draft as Picks);
      setState({ busy: false, saved: true });
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {SLOTS.map(({ key, label, pts }) => {
          const taken: Record<number, string> = {};
          if ((PODIUM as readonly string[]).includes(key)) {
            for (const k of PODIUM) {
              const n = draft[k];
              if (k !== key && n !== null) taken[n] = k.toUpperCase();
            }
          }
          return (
            <DriverSelect
              key={key}
              label={label}
              pts={pts}
              value={draft[key]}
              drivers={grid}
              taken={taken}
              open={openSlot === key}
              onOpenChange={(o) => setOpenSlot((cur) => (o ? key : cur === key ? null : cur))}
              onChange={(n) => pick(key, n)}
            />
          );
        })}
      </div>

      <fieldset className="min-w-0 border-4 border-line p-3">
        <legend className="font-pixel text-pixel-label px-2 leading-normal text-neon-pink">
          CHAOS CALL <span className="text-neon-yellow">+{POINTS.chaos}</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 @min-[640px]/shell:grid-cols-3">
          {CHAOS_CALLS.map((call: ChaosCall) => (
            <ChaosOption key={call} call={call} checked={draft.chaos === call} onChange={(c) => set('chaos', c)} />
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <ArcadeButton type="submit" busy={state.busy} disabled={!complete || drivers.length === 0}>
          {initial ? 'UPDATE PICKS' : 'LOCK IN PICKS'}
        </ArcadeButton>
        {!complete && <span className="text-dim">{filled} OF 7 CALLED. FILL EVERY SLOT TO SAVE.</span>}
        {state.saved && <Notice tone="ok">SAVED. YOU CAN EDIT UNTIL QUALIFYING STARTS.</Notice>}
        {state.error && <Notice tone="error">{state.error}</Notice>}
      </div>
    </form>
  );
}
