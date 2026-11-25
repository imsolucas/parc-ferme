import { CHAOS_LABELS, type ChaosCall } from '@parc-ferme/shared';

interface Props {
  call: ChaosCall;
  checked: boolean;
  onChange: (call: ChaosCall) => void;
  name?: string;
  disabled?: boolean;
}

/** One chaos call: a radio dressed as a pressable tile. */
export function ChaosOption({ call, checked, onChange, name = 'chaos', disabled }: Props) {
  return (
    <label
      className={`no-glow flex min-h-12 cursor-pointer items-center gap-2 border-4 px-2 py-1 last:odd:col-span-full has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-neon-yellow @min-[640px]/shell:last:odd:col-auto ${
        checked ? 'border-neon-pink bg-neon-pink text-void' : 'border-edge bg-void text-ink hover:border-ink'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <input type="radio" name={name} value={call} checked={checked} disabled={disabled} onChange={() => onChange(call)} className="sr-only" />
      <span aria-hidden className={`size-3 shrink-0 border-2 ${checked ? 'border-void bg-void' : 'border-edge'}`} />
      {CHAOS_LABELS[call]}
    </label>
  );
}
