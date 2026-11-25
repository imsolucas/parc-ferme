import type { Driver, LeaderboardRow, League, Me, Picks, Round, RoundDetail, SessionGrant } from '@parc-ferme/shared';
import { getToken, setToken } from './session';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError('No connection. Check your signal and try again.', 0);
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status);
  return data as T;
}

type Grant = Partial<SessionGrant> & { leagueId: string };
const keep = (g: Grant) => {
  if (g.token) setToken(g.token);
  return g;
};

export interface Identity {
  displayName: string;
  initials: string;
}

export const api = {
  me: () => request<Me>('/me'),
  createLeague: (name: string, who?: Identity) => request<Grant>('/leagues', { method: 'POST', body: { name, ...who } }).then(keep),
  invite: (token: string) => request<{ id: string; name: string; season: number; members: number }>(`/invites/${token}`),
  join: (token: string, who?: Identity) => request<Grant>(`/invites/${token}/join`, { method: 'POST', body: who ?? {} }).then(keep),
  league: (id: string) => request<League>(`/leagues/${id}`),
  leaderboard: (id: string, round?: number) => request<LeaderboardRow[]>(`/leagues/${id}/leaderboard${round ? `?round=${round}` : ''}`),
  rounds: (season: number) => request<Round[]>(`/rounds?season=${season}`),
  drivers: () => request<Driver[]>('/drivers'),
  round: (leagueId: string, roundId: number) => request<RoundDetail>(`/leagues/${leagueId}/rounds/${roundId}`),
  savePicks: (leagueId: string, roundId: number, picks: Picks) =>
    request<{ ok: true; savedAt: number }>(`/leagues/${leagueId}/rounds/${roundId}/pick`, { method: 'PUT', body: picks }),
  pushKey: () => request<{ publicKey: string | null }>('/push/key'),
  pushSubscribe: (sub: PushSubscriptionJSON) => request('/push/subscribe', { method: 'POST', body: sub }),
  pushUnsubscribe: (endpoint: string) => request('/push/unsubscribe', { method: 'POST', body: { endpoint } }),
};
