import { Switch } from './Switch';

/** Header switch for the scanline overlay. */
export function CrtToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return <Switch label="CRT" on={on} onChange={onChange} />;
}
