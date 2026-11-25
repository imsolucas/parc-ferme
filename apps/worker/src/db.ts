import type { ChaosCall, Driver, Picks, Round, RoundResults } from '@parc-ferme/shared';

export interface RoundRow {
  id: number;
  season: number;
  name: string;
  location: string;
  country: string;
  quali_session_key: number | null;
  race_session_key: number | null;
  lock_at: number;
  quali_end: number;
  race_start: number;
  race_end: number;
  results_json: string | null;
  results_hash: string | null;
  results_checked_at: number | null;
  scored_at: number | null;
}

export interface PickRow {
  id: number;
  league_id: string;
  user_id: string;
  round_id: number;
  pole: number;
  p1: number;
  p2: number;
  p3: number;
  fastest_lap: number;
  first_dnf: number;
  chaos: ChaosCall;
}

export const EMPTY_RESULTS: RoundResults = {
  pole: null,
  podium: null,
  fastestLap: null,
  firstDnf: null,
  chaos: null,
};

export const parseResults = (row: Pick<RoundRow, 'results_json'>): RoundResults | null =>
  row.results_json ? (JSON.parse(row.results_json) as RoundResults) : null;

export const isComplete = (r: RoundResults | null): boolean =>
  !!r && r.pole !== null && !!r.podium && !!r.fastestLap && !!r.firstDnf && !!r.chaos;

export function toRound(row: RoundRow, now: number): Round {
  const results = parseResults(row);
  return {
    id: row.id,
    season: row.season,
    name: row.name,
    location: row.location,
    country: row.country,
    lockAt: row.lock_at,
    raceStart: row.race_start,
    status: results?.podium ? 'scored' : now >= row.lock_at ? 'locked' : 'open',
    results,
  };
}

export const toPicks = (p: PickRow): Picks => ({
  pole: p.pole,
  p1: p.p1,
  p2: p.p2,
  p3: p.p3,
  fastestLap: p.fastest_lap,
  firstDnf: p.first_dnf,
  chaos: p.chaos,
});

export async function listDrivers(db: D1Database, activeOnly = false): Promise<Driver[]> {
  const { results } = await db
    .prepare(
      `SELECT number, acronym, full_name AS fullName, team, colour FROM drivers
       ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY team, number`,
    )
    .all<Driver>();
  return results;
}

/** Random URL-safe id. */
export function randomId(bytes = 8): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function b64url(data: ArrayBuffer | Uint8Array): string {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
