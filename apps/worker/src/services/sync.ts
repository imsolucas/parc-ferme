import { HOUR, type Env } from '../env';
import type { OpenF1 } from '../openf1/client';
import type { OfDriver, OfMeeting, OfSession } from '../openf1/types';

/**
 * Pull the season calendar and driver list into D1.
 * Cached for 6h, so most cron ticks cost zero OpenF1 requests.
 */
export async function syncCalendar(env: Env, of: OpenF1, now: number, force = false) {
  const season = new Date(now).getUTCFullYear();
  const ttl = force ? 0 : 6 * HOUR;

  const meetings = await of.get<OfMeeting>('meetings', { year: season }, ttl);
  const sessions = await of.get<OfSession>('sessions', { year: season }, ttl);
  let rounds = 0;
  if (!meetings.cached || !sessions.cached) {
    const rows = buildRounds(meetings.data, sessions.data);
    rounds = rows.length;
    if (rows.length > 0) {
      // One statement for the whole calendar; results columns are never touched here.
      await env.DB.prepare(
        `INSERT INTO rounds (id, season, name, location, country, quali_session_key, race_session_key,
                             lock_at, quali_end, race_start, race_end)
         SELECT value->>0, value->>1, value->>2, value->>3, value->>4, value->>5, value->>6,
                value->>7, value->>8, value->>9, value->>10
         FROM json_each(?) WHERE true
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, location = excluded.location, country = excluded.country,
           quali_session_key = excluded.quali_session_key, race_session_key = excluded.race_session_key,
           lock_at = excluded.lock_at, quali_end = excluded.quali_end,
           race_start = excluded.race_start, race_end = excluded.race_end`,
      )
        .bind(JSON.stringify(rows))
        .run();
    }
  }

  const drivers = await of.get<OfDriver>('drivers', { session_key: 'latest' }, force ? 0 : 12 * HOUR);
  if (!drivers.cached && drivers.data.length > 0) await upsertDrivers(env.DB, drivers.data, now, true);

  return { season, rounds, drivers: drivers.cached ? 0 : drivers.data.length };
}

/** A round needs a "Qualifying" (not sprint qualifying) and a "Race" session; testing is skipped. */
export function buildRounds(meetings: OfMeeting[], sessions: OfSession[]) {
  const rows: (string | number)[][] = [];
  for (const m of meetings) {
    if (m.is_cancelled || /testing/i.test(m.meeting_name)) continue;
    const own = sessions.filter((s) => s.meeting_key === m.meeting_key && !s.is_cancelled);
    const quali = own.find((s) => s.session_name === 'Qualifying');
    const race = own.find((s) => s.session_name === 'Race');
    if (!quali || !race) continue;
    rows.push([
      m.meeting_key,
      m.year,
      m.meeting_name,
      m.location,
      m.country_name,
      quali.session_key,
      race.session_key,
      Date.parse(quali.date_start),
      Date.parse(quali.date_end),
      Date.parse(race.date_start),
      Date.parse(race.date_end),
    ]);
  }
  return rows;
}

export async function upsertDrivers(db: D1Database, drivers: OfDriver[], now: number, isCurrentGrid: boolean) {
  const rows = drivers.map((d) => [
    d.driver_number,
    d.name_acronym,
    d.full_name,
    d.team_name ?? 'Unknown',
    d.team_colour ?? 'FFFFFF',
    now,
  ]);
  const stmts = [
    db
      .prepare(
        `INSERT INTO drivers (number, acronym, full_name, team, colour, active, updated_at)
         SELECT value->>0, value->>1, value->>2, value->>3, value->>4, 1, value->>5
         FROM json_each(?) WHERE true
         ON CONFLICT(number) DO UPDATE SET acronym = excluded.acronym, full_name = excluded.full_name,
           team = excluded.team, colour = excluded.colour, active = 1, updated_at = excluded.updated_at`,
      )
      .bind(JSON.stringify(rows)),
  ];
  // Drivers missing from the latest entry list stay in the table (old picks reference them) but leave the picker.
  if (isCurrentGrid) stmts.push(db.prepare('UPDATE drivers SET active = 0 WHERE updated_at < ?').bind(now));
  await db.batch(stmts);
}
