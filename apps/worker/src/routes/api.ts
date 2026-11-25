import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  CHAOS_CALLS,
  type ChaosCall,
  type League,
  type Me,
  type Picks,
  type RoundDetail,
  type SessionGrant,
} from '@parc-ferme/shared';
import { createUser, parseIdentity, requireMember, requireUser, session, type AppEnv } from '../auth';
import { listDrivers, randomId, toRound, type RoundRow } from '../db';
import { OpenF1 } from '../openf1/client';
import { leaderboard, loadPlayers } from '../services/league';
import { processNotificationJobs, queueLockReminders } from '../services/notify';
import { refreshRound } from '../services/results';
import { syncCalendar } from '../services/sync';

export const api = new Hono<AppEnv>();
api.use('*', session);

const body = async (c: { req: { json: () => Promise<unknown> } }) =>
  ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;

interface LeagueRow {
  id: string;
  name: string;
  season: number;
  invite_token: string;
}

async function getLeague(db: D1Database, id: string): Promise<LeagueRow> {
  const league = await db.prepare('SELECT id, name, season, invite_token FROM leagues WHERE id = ?').bind(id).first<LeagueRow>();
  if (!league) throw new HTTPException(404, { message: 'League not found.' });
  return league;
}

async function getRound(db: D1Database, id: string): Promise<RoundRow> {
  const round = await db.prepare('SELECT * FROM rounds WHERE id = ?').bind(Number(id)).first<RoundRow>();
  if (!round) throw new HTTPException(404, { message: 'Round not found.' });
  return round;
}

// ---- identity ---------------------------------------------------------------------------------

api.get('/me', async (c) => {
  const user = requireUser(c.get('user'));
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.name, l.season FROM leagues l JOIN league_members m ON m.league_id = l.id
     WHERE m.user_id = ? ORDER BY m.joined_at DESC`,
  )
    .bind(user.id)
    .all<{ id: string; name: string; season: number }>();
  return c.json<Me>({ userId: user.id, displayName: user.display_name, initials: user.initials, leagues: results });
});

// ---- leagues ----------------------------------------------------------------------------------

/** Create a league. Without a session this also creates the player (displayName + initials). */
api.post('/leagues', async (c) => {
  const b = await body(c);
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < 2 || name.length > 32) throw new HTTPException(400, { message: 'League name must be 2-32 characters.' });

  let user = c.get('user');
  let token: string | null = null;
  if (!user) {
    const id = parseIdentity(b);
    ({ user, token } = await createUser(c.env.DB, id.displayName, id.initials));
  }
  const now = Date.now();
  const leagueId = randomId(6);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO leagues (id, name, season, invite_token, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
      leagueId,
      name,
      new Date(now).getUTCFullYear(),
      randomId(12),
      user.id,
      now,
    ),
    c.env.DB.prepare('INSERT INTO league_members (league_id, user_id, joined_at) VALUES (?, ?, ?)').bind(leagueId, user.id, now),
  ]);
  return c.json<Partial<SessionGrant>>({ leagueId, userId: user.id, ...(token ? { token } : {}) }, 201);
});

/** Public preview of an invite, so the join screen can show what you are joining. */
api.get('/invites/:token', async (c) => {
  const league = await c.env.DB.prepare(
    `SELECT l.id, l.name, l.season, (SELECT COUNT(*) FROM league_members m WHERE m.league_id = l.id) AS members
     FROM leagues l WHERE l.invite_token = ?`,
  )
    .bind(c.req.param('token'))
    .first();
  if (!league) throw new HTTPException(404, { message: 'This invite link is not valid.' });
  return c.json(league);
});

api.post('/invites/:token/join', async (c) => {
  const league = await c.env.DB.prepare('SELECT id FROM leagues WHERE invite_token = ?').bind(c.req.param('token')).first<{ id: string }>();
  if (!league) throw new HTTPException(404, { message: 'This invite link is not valid.' });

  let user = c.get('user');
  let token: string | null = null;
  if (!user) {
    const id = parseIdentity(await body(c));
    ({ user, token } = await createUser(c.env.DB, id.displayName, id.initials));
  }
  await c.env.DB.prepare('INSERT OR IGNORE INTO league_members (league_id, user_id, joined_at) VALUES (?, ?, ?)')
    .bind(league.id, user.id, Date.now())
    .run();
  return c.json<Partial<SessionGrant>>({ leagueId: league.id, userId: user.id, ...(token ? { token } : {}) });
});

api.get('/leagues/:id', async (c) => {
  const user = requireUser(c.get('user'));
  const league = await getLeague(c.env.DB, c.req.param('id'));
  await requireMember(c.env.DB, league.id, user.id);
  const { results: members } = await c.env.DB.prepare(
    `SELECT u.id AS userId, u.display_name AS displayName, u.initials
     FROM league_members m JOIN users u ON u.id = m.user_id WHERE m.league_id = ? ORDER BY m.joined_at`,
  )
    .bind(league.id)
    .all<League['members'][number]>();
  return c.json<League>({ id: league.id, name: league.name, season: league.season, inviteToken: league.invite_token, members });
});

api.get('/leagues/:id/leaderboard', async (c) => {
  const user = requireUser(c.get('user'));
  const league = await getLeague(c.env.DB, c.req.param('id'));
  await requireMember(c.env.DB, league.id, user.id);
  const round = c.req.query('round');
  return c.json(await leaderboard(c.env.DB, league.id, league.season, round ? Number(round) : undefined));
});

// ---- rounds & picks ---------------------------------------------------------------------------

api.get('/rounds', async (c) => {
  const now = Date.now();
  const season = Number(c.req.query('season')) || new Date(now).getUTCFullYear();
  const { results } = await c.env.DB.prepare('SELECT * FROM rounds WHERE season = ? ORDER BY lock_at').bind(season).all<RoundRow>();
  return c.json(results.map((r) => toRound(r, now)));
});

api.get('/drivers', async (c) => c.json(await listDrivers(c.env.DB)));

api.get('/leagues/:id/rounds/:roundId', async (c) => {
  const user = requireUser(c.get('user'));
  const leagueId = c.req.param('id');
  await requireMember(c.env.DB, leagueId, user.id);
  const row = await getRound(c.env.DB, c.req.param('roundId'));
  const now = Date.now();
  const locked = now >= row.lock_at;

  // Before lock you only ever get your own picks back; rivals' picks stay sealed.
  const players = await loadPlayers(c.env.DB, leagueId, row.id, locked ? undefined : user.id);
  const mine = players.find((p) => p.userId === user.id);
  return c.json<RoundDetail>({
    round: toRound(row, now),
    myPicks: mine?.picks ?? null,
    players: locked ? players.map(({ updatedAt: _u, ...p }) => p) : [],
  });
});

function parsePicks(b: Record<string, unknown>): Picks {
  const num = (k: string) => {
    const v = b[k];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 999) {
      throw new HTTPException(400, { message: `Pick "${k}" must be a driver number.` });
    }
    return v;
  };
  const picks: Picks = {
    pole: num('pole'),
    p1: num('p1'),
    p2: num('p2'),
    p3: num('p3'),
    fastestLap: num('fastestLap'),
    firstDnf: num('firstDnf'),
    chaos: b.chaos as ChaosCall,
  };
  if (!CHAOS_CALLS.includes(picks.chaos)) throw new HTTPException(400, { message: 'Unknown chaos call.' });
  if (new Set([picks.p1, picks.p2, picks.p3]).size !== 3) {
    throw new HTTPException(400, { message: 'P1, P2 and P3 must be three different drivers.' });
  }
  return picks;
}

api.put('/leagues/:id/rounds/:roundId/pick', async (c) => {
  const user = requireUser(c.get('user'));
  const leagueId = c.req.param('id');
  const roundId = Number(c.req.param('roundId'));
  await requireMember(c.env.DB, leagueId, user.id);
  const p = parsePicks(await body(c));

  const drivers = [p.pole, p.p1, p.p2, p.p3, p.fastestLap, p.firstDnf];
  const known = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM drivers WHERE number IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify([...new Set(drivers)]))
    .first<{ n: number }>();
  if ((known?.n ?? 0) !== new Set(drivers).size) throw new HTTPException(400, { message: 'Unknown driver in picks.' });

  // The lock is part of the write itself: the row is only inserted/updated while the server clock
  // is before lock_at, so there is no check-then-write gap and the UI cannot be bypassed.
  const now = Date.now();
  const res = await c.env.DB.prepare(
    `INSERT INTO picks (league_id, user_id, round_id, pole, p1, p2, p3, fastest_lap, first_dnf, chaos, updated_at)
     SELECT ?1, ?2, r.id, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
     FROM rounds r
     WHERE r.id = ?3 AND r.lock_at > ?11 AND r.season = (SELECT season FROM leagues WHERE id = ?1)
     ON CONFLICT(league_id, user_id, round_id) DO UPDATE SET
       pole = excluded.pole, p1 = excluded.p1, p2 = excluded.p2, p3 = excluded.p3,
       fastest_lap = excluded.fastest_lap, first_dnf = excluded.first_dnf, chaos = excluded.chaos,
       updated_at = excluded.updated_at`,
  )
    .bind(leagueId, user.id, roundId, p.pole, p.p1, p.p2, p.p3, p.fastestLap, p.firstDnf, p.chaos, now)
    .run();

  if (res.meta.changes === 0) {
    const round = await c.env.DB.prepare('SELECT lock_at FROM rounds WHERE id = ?').bind(roundId).first<{ lock_at: number }>();
    if (!round) throw new HTTPException(404, { message: 'Round not found.' });
    if (now >= round.lock_at) throw new HTTPException(423, { message: 'Picks are locked: parc fermé conditions apply.' });
    throw new HTTPException(400, { message: 'This round is not part of the league season.' });
  }
  return c.json({ ok: true, picks: p, savedAt: now });
});

// ---- push -------------------------------------------------------------------------------------

api.get('/push/key', (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY || null }));

api.post('/push/subscribe', async (c) => {
  const user = requireUser(c.get('user'));
  const b = await body(c);
  const keys = (b.keys ?? {}) as Record<string, unknown>;
  if (typeof b.endpoint !== 'string' || !/^https:\/\//.test(b.endpoint) || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
    throw new HTTPException(400, { message: 'Invalid push subscription.' });
  }
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
  )
    .bind(user.id, b.endpoint, keys.p256dh, keys.auth, Date.now())
    .run();
  return c.json({ ok: true }, 201);
});

api.post('/push/unsubscribe', async (c) => {
  const user = requireUser(c.get('user'));
  const b = await body(c);
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(String(b.endpoint ?? ''), user.id).run();
  return c.json({ ok: true });
});

// ---- admin (x-admin-token) --------------------------------------------------------------------

const admin = new Hono<AppEnv>();
admin.use('*', async (c, next) => {
  if (!c.env.ADMIN_TOKEN || c.req.header('x-admin-token') !== c.env.ADMIN_TOKEN) {
    throw new HTTPException(403, { message: 'Forbidden.' });
  }
  await next();
});
admin.post('/sync', async (c) => c.json(await syncCalendar(c.env, new OpenF1(c.env), Date.now(), true)));
admin.post('/score/:roundId', async (c) => {
  const round = await getRound(c.env.DB, c.req.param('roundId'));
  if (round.quali_session_key === null) throw new HTTPException(400, { message: 'Round has no OpenF1 sessions.' });
  return c.json(await refreshRound(c.env, new OpenF1(c.env), round, Date.now(), true));
});
admin.post('/notify', async (c) => {
  await queueLockReminders(c.env, Date.now());
  return c.json(await processNotificationJobs(c.env, Date.now()));
});
api.route('/admin', admin);
