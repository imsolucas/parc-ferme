import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Countdown } from '../components/game/Countdown';
import { HighScoreTable } from '../components/game/HighScoreTable';
import { PushToggle } from '../components/game/PushToggle';
import { RoundRow } from '../components/game/RoundRow';
import { ArcadeButton, arcadeButtonClass } from '../components/ui/ArcadeButton';
import { Field } from '../components/ui/Field';
import { Loading } from '../components/ui/Loading';
import { Notice } from '../components/ui/Notice';
import { Tilt } from '../components/ui/Tilt';
import { Panel } from '../components/ui/Panel';
import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';

export function LeagueScreen() {
  const { leagueId = '' } = useParams();
  const data = useAsync(async () => {
    const [league, me, board] = await Promise.all([api.league(leagueId), api.me(), api.leaderboard(leagueId)]);
    return { league, me, board, rounds: await api.rounds(league.season) };
  }, [leagueId]);
  const [copied, setCopied] = useState(false);

  if (data.loading) return <Loading />;
  if (data.error || !data.data) return <Tilt message={data.error?.message ?? 'LEAGUE NOT FOUND.'} onRetry={data.reload} />;
  const { league, me, board, rounds } = data.data;

  const next = rounds.find((r) => r.status === 'open');
  const inviteUrl = `${window.location.origin}/join/${league.inviteToken}`;
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy the invite link:', inviteUrl);
    }
  };

  return (
    <>
      <div>
        <h1 className="text-pixel-h1 break-words text-neon-cyan">{league.name}</h1>
        <p className="mt-1 text-dim">
          {league.season} SEASON · {league.members.length} PLAYER{league.members.length === 1 ? '' : 'S'}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <Field label="INVITE LINK" readOnly value={inviteUrl.replace(/^https?:\/\//, '')} onFocus={(e) => e.target.select()} className="text-dim" />
        <ArcadeButton tone="ghost" onClick={copyInvite}>
          {copied ? 'COPIED' : 'COPY'}
        </ArcadeButton>
      </div>

      {next ? (
        <Panel title={`NEXT UP: ${next.name}`} accent="text-neon-yellow">
          <Countdown lockAt={next.lockAt} onExpire={data.reload} />
          <Link to={`/league/${league.id}/round/${next.id}`} className={`mt-4 ${arcadeButtonClass()}`}>
            {'>'} MAKE YOUR PICKS
          </Link>
        </Panel>
      ) : (
        <Notice>NO ROUND IS OPEN RIGHT NOW. THE CALENDAR SYNCS AUTOMATICALLY.</Notice>
      )}

      <Panel title="HIGH SCORES · SEASON" accent="text-neon-pink">
        <HighScoreTable rows={board} meId={me.userId} />
      </Panel>

      <Panel title="ROUNDS">
        {rounds.length === 0 ? (
          <Notice>THE CALENDAR HAS NOT SYNCED YET. CHECK BACK IN A FEW MINUTES.</Notice>
        ) : (
          <ul className="divide-y-2 divide-line">
            {rounds.map((r, i) => (
              <RoundRow key={r.id} index={i + 1} round={r} to={`/league/${league.id}/round/${r.id}`} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="ALERTS">
        <PushToggle />
      </Panel>
    </>
  );
}
