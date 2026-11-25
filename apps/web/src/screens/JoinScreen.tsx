import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IdentityFields } from '../components/game/IdentityFields';
import { ArcadeButton } from '../components/ui/ArcadeButton';
import { Blink } from '../components/ui/Blink';
import { Loading } from '../components/ui/Loading';
import { Notice } from '../components/ui/Notice';
import { Tilt } from '../components/ui/Tilt';
import { Panel } from '../components/ui/Panel';
import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { getToken } from '../lib/session';

export function JoinScreen() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const invite = useAsync(() => api.invite(token), [token]);
  const hasSession = !!getToken();
  const [who, setWho] = useState({ displayName: '', initials: '' });
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setState({ busy: true });
    try {
      const grant = await api.join(token, hasSession ? undefined : who);
      navigate(`/league/${grant.leagueId}`);
    } catch (err) {
      setState({ busy: false, error: (err as Error).message });
    }
  };

  if (invite.loading) return <Loading />;
  if (invite.error || !invite.data) return <Tilt message={invite.error?.message ?? 'INVITE NOT FOUND.'} onRetry={invite.reload} />;

  return (
    <>
      <section className="py-6 text-center @min-[640px]/shell:py-10">
        <p className="font-pixel text-pixel-title leading-normal text-neon-yellow">
          <Blink>A NEW CHALLENGER APPROACHES</Blink>
        </p>
        <h1 className="text-pixel-h1 mt-4 break-words text-neon-cyan">{invite.data.name}</h1>
        <p className="mt-1 text-dim">
          {invite.data.season} SEASON · {invite.data.members} PLAYER{invite.data.members === 1 ? '' : 'S'}
        </p>
      </section>
      <Panel title="JOIN LEAGUE" accent="text-neon-yellow">
        <form onSubmit={join} className="flex flex-col gap-4">
          {!hasSession && <IdentityFields value={who} onChange={setWho} />}
          <div className="flex flex-wrap items-center gap-4">
            <ArcadeButton type="submit" busy={state.busy}>
              PRESS START
            </ArcadeButton>
            {state.error && <Notice tone="error">{state.error}</Notice>}
          </div>
        </form>
      </Panel>
    </>
  );
}
