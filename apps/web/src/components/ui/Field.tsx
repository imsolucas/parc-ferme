import { useId, type InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  /** Replaces the hint and marks the input invalid. */
  error?: string;
}

/** Labelled text input in terminal style. */
export function Field({ label, hint, error, id, className = '', ...rest }: Props) {
  const auto = useId();
  const inputId = id ?? `f-${auto.replace(/[^a-zA-Z0-9]/g, '')}`;
  const noteId = `${inputId}-note`;
  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className="font-pixel text-pixel-label mb-2 block leading-normal text-dim">
        {label}
      </label>
      <input
        id={inputId}
        {...rest}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? noteId : undefined}
        className={`block min-h-12 w-full border-4 bg-void px-3 py-2 text-ink uppercase placeholder:text-dim focus:border-neon-yellow focus:outline-none disabled:opacity-50 ${
          error ? 'border-neon-red' : 'border-edge hover:border-ink'
        } ${className}`}
      />
      {(hint || error) && (
        <span id={noteId} className={`text-term-small mt-1 block ${error ? 'text-neon-red' : 'text-dim'}`}>
          {error ? `[!] ${error}` : hint}
        </span>
      )}
    </div>
  );
}
