import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { INITIALS_RE } from '@parc-ferme/shared';
import type { Env } from './env';
import { randomId, sha256Hex } from './db';

// Device-bound sessions: the server mints a random token when a player first creates or joins a
// league, stores only its SHA-256, and the browser keeps the token in localStorage.

export interface UserRow {
  id: string;
  display_name: string;
  initials: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: UserRow | null } };

async function userFromRequest(db: D1Database, header: string | undefined): Promise<UserRow | null> {
  const token = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return null;
  return db
    .prepare('SELECT id, display_name, initials FROM users WHERE token_hash = ?')
    .bind(await sha256Hex(token))
    .first<UserRow>();
}

/** Resolves the session if one is sent; routes decide whether it is required. */
export const session = createMiddleware<AppEnv>(async (c, next) => {
  c.set('user', await userFromRequest(c.env.DB, c.req.header('authorization')));
  await next();
});

export function requireUser(user: UserRow | null): UserRow {
  if (!user) throw new HTTPException(401, { message: 'Sign in by creating or joining a league.' });
  return user;
}

export function parseIdentity(body: { displayName?: unknown; initials?: unknown }) {
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const initials = typeof body.initials === 'string' ? body.initials.trim().toUpperCase() : '';
  if (displayName.length < 1 || displayName.length > 24) {
    throw new HTTPException(400, { message: 'Display name must be 1-24 characters.' });
  }
  if (!INITIALS_RE.test(initials)) {
    throw new HTTPException(400, { message: 'Initials must be exactly 3 letters or digits.' });
  }
  return { displayName, initials };
}

export async function createUser(db: D1Database, displayName: string, initials: string) {
  const id = randomId(8);
  const token = randomId(32);
  await db
    .prepare('INSERT INTO users (id, display_name, initials, token_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, displayName, initials, await sha256Hex(token), Date.now())
    .run();
  return { user: { id, display_name: displayName, initials } satisfies UserRow, token };
}

export async function requireMember(db: D1Database, leagueId: string, userId: string) {
  const row = await db
    .prepare('SELECT 1 AS ok FROM league_members WHERE league_id = ? AND user_id = ?')
    .bind(leagueId, userId)
    .first();
  if (!row) throw new HTTPException(403, { message: 'You are not in this league.' });
}
