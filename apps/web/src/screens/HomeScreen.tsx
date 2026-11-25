import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IdentityFields } from '../components/game/IdentityFields';
import { ArcadeButton } from '../components/ui/ArcadeButton';
import { Blink } from '../components/ui/Blink';
import { Field } from '../components/ui/Field';
import { Loading } from '../components/ui/Loading';
import { Notice } from '../components/ui/Notice';
import { Panel } from '../components/ui/Panel';
import { ApiError, api } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { clearToken, getToken } from '../lib/session';

export function HomeScreen() {
  const navigate = useNavigate();
  const me = useAsync(async () => {
    if (!getToken()) return null;
    try {
      return await api.me();
    } catch (e) {
      // A token the server no longer knows is useless; drop it and show the start screen.
      if (e instanceof ApiError && e.status === 401) {
        clearToken();
        return null;
      }
      throw e;
    }
  }, []);

  const [name, setName] = useState('');
  const [who, setWho] = useState({ displayName: '', initials: '' });
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setState({ busy: true });
    try {
      const grant = await api.createLeague(name.trim(), me.data ? undefined : who);
      navigate(`/league/${grant.leagueId}`);
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };

  if (me.loading) return <Loading />;

  return (
    <>
      <section className="py-6 text-center @min-[640px]/shell:py-10">
        <h1 className="text-pixel-hero text-neon-red @min-[640px]/shell:text-pixel-hero-lg">PARC FERMÉ</h1>
        <p className="mt-2 text-neon-cyan">F1 PICK'EM LEAGUE · {new Date().getFullYear()} SEASON</p>
        <p className="font-pixel text-pixel-title mt-6 leading-normal text-neon-yellow">
          <Blink>{me.data ? `PLAYER ${me.data.initials} READY` : 'INSERT COIN'}</Blink>
        </p>
      </section>

      {me.error && <Notice tone="error">{me.error.message}</Notice>}

      {me.data && (
        <Panel title="YOUR LEAGUES">
          {me.data.leagues.length === 0 ? (
            <Notice>NO LEAGUES YET. START ONE BELOW OR OPEN AN INVITE LINK.</Notice>
          ) : (
            <ul className="flex flex-col gap-2">
              {me.data.leagues.map((l) => (
                <li key={l.id}>
                  <Link
                    to={`/league/${l.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 border-4 border-edge px-3 py-2 text-ink no-underline hover:border-neon-yellow hover:text-neon-yellow"
                  >
                    <span>{l.name.toUpperCase()}</span>
                    <span className="text-dim">
                      {l.season} {'>'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel title={me.data ? 'NEW LEAGUE' : '1 PLAYER START'} accent="text-neon-yellow">
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field label="LEAGUE NAME" required minLength={2} maxLength={32} value={name} onChange={(e) => setName(e.target.value)} />
          {!me.data && <IdentityFields value={who} onChange={setWho} />}
          <div className="flex flex-wrap items-center gap-4">
            <ArcadeButton type="submit" busy={state.busy}>
              CREATE LEAGUE
            </ArcadeButton>
            {state.error && <Notice tone="error">{state.error}</Notice>}
          </div>
        </form>
      </Panel>

      {!me.data && (
        <Panel title="HOW TO PLAY" accent="text-neon-pink">
          <ol className="flex flex-col gap-2">
            {[
              'CREATE A LEAGUE AND SHARE THE INVITE LINK.',
              'CALL POLE, THE PODIUM, FASTEST LAP, FIRST DNF AND ONE CHAOS EVENT.',
              'PICKS LOCK WHEN QUALIFYING STARTS.',
              'SCORES LAND AFTER THE CHEQUERED FLAG. UP TO 27 PTS A ROUND.',
            ].map((step, i) => (
              <li key={step} className="grid grid-cols-[28px_1fr]">
                <span aria-hidden className="font-pixel text-pixel-title leading-[25px] text-neon-pink">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-dim">GOT AN INVITE LINK? OPEN IT TO JOIN A LEAGUE.</p>
        </Panel>
      )}
    </>
  );
}
