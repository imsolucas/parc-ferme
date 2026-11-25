import type { ButtonHTMLAttributes } from 'react';

type Tone = 'yellow' | 'cyan' | 'red' | 'ghost';

const FILLED = '[&:not(:disabled)]:hover:bg-ink [&:not(:disabled)]:hover:border-ink';
const tones: Record<Tone, string> = {
  yellow: `bg-neon-yellow text-void border-neon-yellow ${FILLED}`,
  cyan: `bg-neon-cyan text-void border-neon-cyan ${FILLED}`,
  red: `bg-neon-red text-void border-neon-red ${FILLED}`,
  ghost: 'bg-void text-ink border-edge [&:not(:disabled)]:hover:border-ink',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  busy?: boolean;
}

/** Shared look, so links can wear the button skin too (see LeagueScreen). */
export const arcadeButtonClass = (tone: Tone = 'yellow') =>
  `no-glow font-pixel text-pixel-button inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border-4 px-4 py-2 text-center leading-normal tracking-wider uppercase no-underline shadow-pixel active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`;

/** Chunky cabinet button with a hard pixel shadow. */
export function ArcadeButton({ tone = 'yellow', busy, disabled, className = '', children, type = 'button', ...rest }: Props) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`${arcadeButtonClass(tone)} ${className}`}
    >
      {busy ? 'LOADING...' : children}
    </button>
  );
}
