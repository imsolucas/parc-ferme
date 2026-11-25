import { Field } from './Field';

interface Props {
  value: string;
  /** Receives up to three characters, A-Z and 0-9 only. */
  onChange: (initials: string) => void;
  error?: string;
}

/** Three-character high-score initials, entered like a cabinet name screen. */
export function InitialsInput({ value, onChange, error }: Props) {
  return (
    <Field
      label="INITIALS"
      required
      maxLength={3}
      minLength={3}
      pattern="[A-Za-z0-9]{3}"
      placeholder="AAA"
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      hint="3 LETTERS OR DIGITS"
      error={error}
      className="font-pixel text-pixel-h1 pl-[calc(0.75rem+0.3em)] text-center leading-normal tracking-[0.3em] text-neon-yellow"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))}
    />
  );
}
