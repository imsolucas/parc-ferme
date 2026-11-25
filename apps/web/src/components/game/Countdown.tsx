import { useEffect } from 'react';
import { useNow } from '../../lib/hooks';
import { countdownParts, localDateTime } from '../../lib/time';

const pad = (n: number) => String(n).padStart(2, '0');

/** Timing-screen countdown to lock, with the lock time in the viewer's local zone. */
export function Countdown({ lockAt, onExpire }: { lockAt: number; onExpire?: () => void }) {
  const now = useNow(1000);
  const left = lockAt - now;
  const expired = left <= 0;
  useEffect(() => {
    if (expired) onExpire?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);
  if (expired) {
    return <p className="font-pixel text-pixel-title leading-normal text-neon-red">PICKS LOCKED</p>;
  }
  const { d, h, m, s } = countdownParts(left);
  const urgent = left < 60 * 60 * 1000;
  const cells: [string, string][] = [
    [pad(d), 'DAYS'],
    [pad(h), 'HRS'],
    [pad(m), 'MIN'],
    [pad(s), 'SEC'],
  ];
  return (
    <div>
      <div
        role="timer"
        aria-label={`Picks lock in ${d} days ${h} hours ${m} minutes`}
        className={`flex gap-2 ${urgent ? 'text-neon-red' : 'text-neon-green'}`}
      >
        {cells.map(([value, unit]) => (
          <div key={unit} className="flex-1 border-4 border-line bg-void pt-3 pb-2 text-center">
            <div className="font-pixel text-pixel-timer leading-none tabular-nums @min-[640px]/shell:text-pixel-timer-lg">{value}</div>
            <div className="text-term-unit mt-2 text-dim">{unit}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-dim">
        {urgent ? 'LAST HOUR. ' : ''}LOCKS {localDateTime(lockAt)}
      </p>
    </div>
  );
}
