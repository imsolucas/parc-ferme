import type { ReactNode } from 'react';

const tones = {
  error: { cls: 'border-neon-red text-neon-red', tag: '[!]' },
  ok: { cls: 'border-neon-green text-neon-green', tag: '[OK]' },
  info: { cls: 'border-edge text-dim', tag: '[i]' },
};

/** Inline status line: errors, confirmations, empty states. The tag carries the tone, not colour alone. */
export function Notice({ tone = 'info', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`flex items-baseline gap-2 border-l-4 pl-3 ${tones[tone].cls}`}>
      <span aria-hidden className="font-pixel text-pixel-micro shrink-0 leading-normal">
        {tones[tone].tag}
      </span>
      <span>{children}</span>
    </p>
  );
}
