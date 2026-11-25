import { Link, useParams } from 'react-router-dom';
import type { Picks } from '@parc-ferme/shared';
import { Countdown } from '../components/game/Countdown';
import { HighScoreTable } from '../components/game/HighScoreTable';
import { PickForm } from '../components/game/PickForm';
import { PicksTable } from '../components/game/PicksTable';
import { ArcadeButton } from '../components/ui/ArcadeButton';
import { Blink } from '../components/ui/Blink';
import { Loading } from '../components/ui/Loading';
import { Notice } from '../components/ui/Notice';
import { Tilt } from '../components/ui/Tilt';
import { Panel } from '../components/ui/Panel';
import { api } from '../lib/api';
import { useAsync, useDrivers } from '../lib/hooks';
import { localDateTime } from '../lib/time';

export function RoundScreen() {
  const { leagueId = '', roundId = '' } = useParams();
  const id = Number(roundId);
  const drivers = useDrivers();
  const data = useAsync(async () => {
    const [detail, me] = await Promise.all([api.round(leagueId, id), api.me()]);
    const board = detail.round.status === 'open' ? [] : await api.leaderboard(leagueId, id);
    return { detail, me, board };
  }, [leagueId, id]);

  if (data.loading) return <Loading />;
  if (data.error || !data.data) return <Tilt message={data.error?.message ?? 'ROUND NOT FOUND.'} onRetry={data.reload} />;
  const { detail, me, board } = data.data;
  const { round, myPicks, players } = detail;
  const sharePath = `/share/${leagueId}/${me.userId}/${round.id}`;

  const save = async (picks: Picks) => {
    await api.savePicks(leagueId, round.id, picks);
  };

  const share = async () => {
    const url = `${window.location.origin}${sharePath}`;
    if (navigator.share) {
      await navigator.share({ title: 'PARC FERMÉ', url }).catch(() => undefined);
    } else {
      window.open(url, '_blank', 'noopener');
    }
  };

  return (
    <>
      <div>
        <Link to={`/league/${leagueId}`} className="inline-flex min-h-11 items-center text-dim no-underline hover:text-ink">
          {'<'} LEAGUE
        </Link>
        <h1 className="text-pixel-h1 break-words text-neon-cyan">{round.name}</h1>
        <p className="mt-1 text-dim">
          {round.location.toUpperCase()} · RACE {localDateTime(round.raceStart)}
        </p>
      </div>

      {round.status === 'open' && (
        <>
          <Panel title="PICKS LOCK IN" accent="text-neon-yellow">
            <Countdown lockAt={round.lockAt} onExpire={data.reload} />
          </Panel>
          <Panel title="YOUR PICKS">
            <PickForm key={round.id} drivers={drivers.list} initial={myPicks} onSave={save} />
          </Panel>
          <Notice>RIVALS' PICKS STAY HIDDEN UNTIL QUALIFYING STARTS.</Notice>
        </>
      )}

      {round.status !== 'open' && (
        <>
          {round.status === 'locked' && (
            <Panel accent="text-neon-red" title="PARC FERMÉ">
              <p>
                PICKS ARE LOCKED. <Blink className="text-neon-yellow">WAITING FOR RESULTS</Blink>
              </p>
              <p className="mt-1 text-dim">SCORES UPDATE AUTOMATICALLY AFTER QUALIFYING AND THE RACE.</p>
            </Panel>
          )}

          <Panel title="HIGH SCORES · THIS ROUND" accent="text-neon-pink">
            <HighScoreTable rows={board} meId={me.userId} pending={players.every((p) => Object.values(p.breakdown).every((v) => v === null))} />
          </Panel>

          <Panel
            title="TIMING SCREEN"
            flush
            action={
              myPicks && (
                <ArcadeButton tone="cyan" onClick={share}>
                  SHARE MY CARD
                </ArcadeButton>
              )
            }
          >
            {players.length === 0 ? (
              <Notice>NOBODY MADE PICKS FOR THIS ROUND.</Notice>
            ) : (
              <PicksTable players={players} results={round.results} drivers={drivers.byNumber} meId={me.userId} />
            )}
          </Panel>
          {!myPicks && <Notice>YOU DID NOT ENTER PICKS FOR THIS ROUND.</Notice>}
        </>
      )}
    </>
  );
}
