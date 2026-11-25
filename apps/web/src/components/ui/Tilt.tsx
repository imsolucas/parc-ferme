import { Link } from 'react-router-dom';
import { ArcadeButton } from './ArcadeButton';
import { Notice } from './Notice';
import { Panel } from './Panel';

/** Full-screen error: what happened, a retry, and the way home. */
export function Tilt({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Panel title="TILT" accent="text-neon-red">
      <div className="flex flex-col gap-4">
        <Notice tone="error">{message}</Notice>
        <div className="flex flex-wrap items-center gap-4">
          {onRetry && (
            <ArcadeButton tone="ghost" onClick={onRetry}>
              TRY AGAIN
            </ArcadeButton>
          )}
          <Link to="/" className="inline-flex min-h-11 items-center text-dim no-underline hover:text-ink">
            {'<'} BACK TO START
          </Link>
        </div>
      </div>
    </Panel>
  );
}
