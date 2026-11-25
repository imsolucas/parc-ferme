import { useEffect, useState } from 'react';
import { currentSubscription, disablePush, enablePush, pushSupported } from '../../lib/push';
import { Notice } from '../ui/Notice';
import { Switch } from '../ui/Switch';

/** Lock reminders (T-60, T-10) and "results in" alerts, on or off for this device. */
export function PushToggle() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void currentSubscription().then((s) => setOn(!!s));
  }, []);

  if (!pushSupported()) return <Notice>ALERTS NEED AN INSTALLED APP OR A BROWSER WITH PUSH SUPPORT.</Notice>;

  const flip = async () => {
    setBusy(true);
    setError(null);
    try {
      await (on ? disablePush() : enablePush());
      setOn(!on);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex-[1_1_200px] text-dim">LOCK REMINDERS 60 AND 10 MIN BEFORE QUALIFYING, PLUS RESULTS.</p>
        <Switch label="ALERTS" on={on} busy={busy} onChange={flip} />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
