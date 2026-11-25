/** Scanline + vignette layer. Decorative, never intercepts input. */
export function CrtOverlay({ on }: { on: boolean }) {
  return on ? <div aria-hidden className="crt-overlay" /> : null;
}
