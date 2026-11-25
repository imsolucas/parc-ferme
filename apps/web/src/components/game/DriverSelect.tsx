import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Driver } from '@parc-ferme/shared';

interface Props {
  label: string;
  /** Shown as +pts: "3" or "5/2". */
  pts?: string;
  value: number | null;
  /** Ordered so teammates are adjacent. */
  drivers: Driver[];
  onChange: (driver: number) => void;
  /** Car number to the slot that already uses it, e.g. { 1: 'P1' }. */
  taken?: Record<number, string>;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SheetProps extends Pick<Props, 'label' | 'pts' | 'value' | 'drivers'> {
  taken: Record<number, string>;
  inline: boolean;
  onPick: (driver: number) => void;
  onClose: () => void;
}

/** The 22-driver grid: one tap per driver, teammates side by side. */
function DriverSheet({ label, pts, value, drivers, taken, inline, onPick, onClose }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[data-tile][aria-pressed="true"], [data-tile]:not(:disabled)')?.focus({ preventScroll: true });
  }, []);
  return (
    <>
      {!inline && <div className="fixed inset-0 z-30 bg-void/80" onClick={onClose} />}
      <div
        ref={ref}
        role="dialog"
        aria-label={`Select driver for ${label}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
        className={`no-glow bg-panel px-4 pt-3 pb-4 ${
          inline
            ? 'mt-2 border-4 border-neon-yellow shadow-pixel'
            : 'fixed inset-x-0 bottom-0 z-[31] max-h-[85%] overflow-auto border-t-4 border-neon-yellow pb-[calc(1rem+env(safe-area-inset-bottom))]'
        }`}
      >
        <div className="mb-2 flex items-center gap-3">
          <span className="font-pixel text-pixel-title leading-normal text-neon-cyan">PICK {label}</span>
          {pts && <span className="text-neon-yellow">+{pts}</span>}
          <button
            type="button"
            aria-label="Close driver list"
            onClick={onClose}
            className="font-pixel text-pixel-button ml-auto size-11 cursor-pointer border-4 border-edge bg-void hover:border-ink"
          >
            X
          </button>
        </div>
        <div className={`grid gap-2 ${inline ? 'grid-cols-6' : 'grid-cols-4'}`}>
          {drivers.map((d) => {
            const used = taken[d.number];
            const picked = d.number === value;
            return (
              <button
                key={d.number}
                type="button"
                data-tile
                disabled={!!used}
                aria-pressed={picked}
                aria-label={`${d.fullName}, ${d.team}${used ? `, already ${used}` : ''}`}
                onClick={() => onPick(d.number)}
                className={`grid min-h-12 cursor-pointer grid-cols-[6px_1fr] content-center gap-x-2 border-2 pr-1 text-left disabled:cursor-not-allowed disabled:border-dashed ${
                  picked ? 'border-neon-yellow bg-neon-yellow text-void' : 'border-edge bg-void [&:not(:disabled)]:hover:border-ink'
                }`}
              >
                <i aria-hidden className={`row-span-2 self-stretch ${used ? 'opacity-40' : ''}`} style={{ background: `#${d.colour}` }} />
                <span className={`font-pixel text-pixel-button self-end leading-normal ${used ? 'text-dim line-through' : ''}`}>{d.acronym}</span>
                <span className={`text-term-unit self-start leading-none ${picked ? 'text-void' : 'text-dim'}`}>{used ?? d.number}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** One pick slot. Opens a 22-driver grid: a bottom sheet on a phone, in place from 640px of shell. */
export function DriverSelect({ label, pts, value, drivers, onChange, taken = {}, disabled, open, onOpenChange }: Props) {
  const trigger = useRef<HTMLButtonElement>(null);
  // Where the sheet goes is measured, not styled: in place when the shell is 640px or wider,
  // otherwise a fixed bottom sheet mounted on the Shell root, outside the query container.
  const [place, setPlace] = useState<{ inline: boolean; host: Element } | null>(null);
  useEffect(() => {
    if (!open) {
      setPlace(null);
      return;
    }
    const el = trigger.current!;
    const box = el.closest('[data-shell-box]') ?? document.body;
    const inline = box.clientWidth >= 640;
    setPlace({ inline, host: el.closest('[data-shell]') ?? document.body });
    if (inline) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => {
    onOpenChange(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const chosen = drivers.find((d) => d.number === value);
  const sheet = open && place && (
    <DriverSheet
      label={label}
      pts={pts}
      value={value}
      drivers={drivers}
      taken={taken}
      inline={place.inline}
      onClose={close}
      onPick={(n) => {
        onChange(n);
        close();
      }}
    />
  );
  return (
    <div className="min-w-0">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`flex min-h-12 w-full cursor-pointer items-stretch border-4 bg-void text-left disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-neon-yellow' : 'border-edge hover:border-ink'
        }`}
      >
        <span aria-hidden className="w-2 shrink-0" style={{ background: chosen ? `#${chosen.colour}` : 'transparent' }} />
        <span className="font-pixel text-pixel-label flex w-[100px] shrink-0 items-center px-2 leading-normal text-neon-cyan @min-[640px]/shell:w-[120px]">
          {label}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {chosen ? (
            <>
              <span>{chosen.acronym}</span>
              <span className="hidden truncate text-dim @min-[640px]/shell:block">{chosen.fullName}</span>
            </>
          ) : (
            <span className="text-dim">SELECT DRIVER</span>
          )}
        </span>
        {pts && (
          <span className="flex shrink-0 items-center px-2 text-neon-yellow" aria-label={`worth ${pts} points`}>
            +{pts}
          </span>
        )}
        <span
          aria-hidden
          className={`font-pixel text-pixel-label flex w-6 shrink-0 items-center justify-center ${open ? 'rotate-90 text-neon-yellow' : 'text-dim'}`}
        >
          {'>'}
        </span>
      </button>
      {sheet && place && (place.inline ? sheet : createPortal(sheet, place.host))}
    </div>
  );
}
