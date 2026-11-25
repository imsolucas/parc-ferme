interface Props {
  label: string;
  on: boolean;
  busy?: boolean;
  onChange: (on: boolean) => void;
}

/** Two-cell pixel switch. The lit cell moves and the word changes, so state never rests on colour. */
export function Switch({ label, on, busy, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={() => onChange(!on)}
      className="font-pixel text-pixel-label inline-flex min-h-11 cursor-pointer items-center gap-2 border-4 border-edge bg-void px-3 leading-normal text-dim hover:border-ink disabled:opacity-50"
    >
      <span className="text-ink">{label}</span>
      <span aria-hidden className="inline-flex gap-0.5 border-2 border-edge p-0.5">
        <i className={`block size-2.5 ${on ? 'bg-void' : 'bg-dim'}`} />
        <i className={`block size-2.5 ${on ? 'bg-neon-green' : 'bg-void'}`} />
      </span>
      <span className={`min-w-[30px] text-left ${on ? 'text-neon-green' : ''}`}>{busy ? '...' : on ? 'ON' : 'OFF'}</span>
    </button>
  );
}
