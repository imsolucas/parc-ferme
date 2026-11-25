// Seeds the LOCAL D1 database with a fake league, four players, one scored past round
// (real 2026 Las Vegas GP data from the test fixtures) and one open round that locks in 2 days.
// Usage: pnpm seed            (after `pnpm db:migrate:local`)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATEGORIES, type Picks } from '@parc-ferme/shared';
import type { OfDriver, OfLap, OfRaceControl, OfSessionResult } from '../src/openf1/types';
import { derivePole, deriveRace, hashResults } from '../src/scoring/derive';
import { scorePicks } from '../src/scoring/score';

const root = join(import.meta.dirname, '..');
const fixture = <T>(name: string): T => JSON.parse(readFileSync(join(root, 'test/fixtures', `${name}.json`), 'utf8')) as T;
const q = (v: string | number | null) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const now = Date.now();
const DAY = 86_400_000;
const season = new Date(now).getUTCFullYear();
const LEAGUE = 'seedleague';
const PAST = 1300; // Las Vegas 2026 (OpenF1 meeting_key), so `admin/score/1300` works against the live API too
const OPEN = 900001; // fake round, never fetched from OpenF1

const raceStart = Date.parse('2026-11-22T04:00:00Z');
const results = {
  pole: derivePole(fixture<OfSessionResult[]>('quali_result')),
  ...deriveRace({
    result: fixture<OfSessionResult[]>('race_result'),
    laps: fixture<OfLap[]>('laps'),
    raceControl: fixture<OfRaceControl[]>('race_control'),
    raceStart,
  }),
};

const players: { id: string; name: string; initials: string; past: Picks; open?: Picks }[] = [
  { id: 'seed-ace', name: 'Ace Ventura', initials: 'ACE',
    past: { pole: 12, p1: 3, p2: 1, p3: 81, fastestLap: 30, firstDnf: 11, chaos: 'SAFETY_CAR' },
    open: { pole: 1, p1: 1, p2: 3, p3: 81, fastestLap: 12, firstDnf: 41, chaos: 'VSC' } },
  { id: 'seed-max', name: 'Maximum Attack', initials: 'MAX',
    past: { pole: 3, p1: 1, p2: 3, p3: 12, fastestLap: 3, firstDnf: 41, chaos: 'SAFETY_CAR' },
    open: { pole: 3, p1: 3, p2: 1, p3: 12, fastestLap: 3, firstDnf: 11, chaos: 'NO_SC' } },
  { id: 'seed-box', name: 'Box Box', initials: 'BOX',
    past: { pole: 12, p1: 12, p2: 81, p3: 3, fastestLap: 1, firstDnf: 23, chaos: 'NO_SC' } },
  { id: 'seed-drs', name: 'DRS Train', initials: 'DRS',
    past: { pole: 1, p1: 81, p2: 1, p3: 63, fastestLap: 30, firstDnf: 11, chaos: 'RED_FLAG' } },
];

const sql: string[] = [
  `DELETE FROM pick_scores WHERE pick_id IN (SELECT id FROM picks WHERE league_id = ${q(LEAGUE)});`,
  `DELETE FROM picks WHERE league_id = ${q(LEAGUE)};`,
  `DELETE FROM card_cache WHERE league_id = ${q(LEAGUE)};`,
  `DELETE FROM league_members WHERE league_id = ${q(LEAGUE)};`,
  `DELETE FROM leagues WHERE id = ${q(LEAGUE)};`,
  `DELETE FROM users WHERE id LIKE 'seed-%';`,
  `DELETE FROM notification_jobs WHERE round_id IN (${PAST}, ${OPEN});`,
];

for (const d of fixture<OfDriver[]>('drivers')) {
  sql.push(
    `INSERT OR REPLACE INTO drivers (number, acronym, full_name, team, colour, active, updated_at) VALUES (${[
      d.driver_number, d.name_acronym, d.full_name, d.team_name ?? 'Unknown', d.team_colour ?? 'FFFFFF', 1, now,
    ].map(q).join(', ')});`,
  );
}

const round = (cols: (string | number | null)[]) =>
  `INSERT OR REPLACE INTO rounds (id, season, name, location, country, quali_session_key, race_session_key, lock_at, quali_end, race_start, race_end, results_json, results_hash, results_checked_at, scored_at) VALUES (${cols.map(q).join(', ')});`;
sql.push(
  round([PAST, season, 'Las Vegas Grand Prix', 'Las Vegas', 'United States', 11416, 11420,
    Date.parse('2026-11-21T04:00:00Z'), Date.parse('2026-11-21T05:00:00Z'), raceStart, raceStart + 2 * 3_600_000,
    JSON.stringify(results), await hashResults(results), now, now]),
  round([OPEN, season, 'Neon City Grand Prix', 'Neon City', 'Arcadia', null, null,
    now + 2 * DAY, now + 2 * DAY + 3_600_000, now + 3 * DAY, now + 3 * DAY + 7_200_000, null, null, null, null]),
);

// The device token of a seed player is just its id, so you can log in at /login#<id>.
for (const p of players) {
  sql.push(
    `INSERT INTO users (id, display_name, initials, token_hash, created_at) VALUES (${[p.id, p.name, p.initials, sha(p.id), now].map(q).join(', ')});`,
  );
}
sql.push(
  `INSERT INTO leagues (id, name, season, invite_token, owner_id, created_at) VALUES (${[LEAGUE, 'Pit Lane Legends', season, 'seed-invite', 'seed-ace', now].map(q).join(', ')});`,
);

for (const [i, p] of players.entries()) {
  sql.push(
    `INSERT INTO league_members (league_id, user_id, joined_at) VALUES (${[LEAGUE, p.id, now + i].map(q).join(', ')});`,
  );
  const pick = (roundId: number, k: Picks) =>
    `INSERT INTO picks (league_id, user_id, round_id, pole, p1, p2, p3, fastest_lap, first_dnf, chaos, updated_at) VALUES (${[
      LEAGUE, p.id, roundId, k.pole, k.p1, k.p2, k.p3, k.fastestLap, k.firstDnf, k.chaos, now,
    ].map(q).join(', ')});`;
  sql.push(pick(PAST, p.past));
  if (p.open) sql.push(pick(OPEN, p.open));

  const breakdown = scorePicks(p.past, results); // same code path the cron uses
  for (const cat of CATEGORIES) {
    sql.push(
      `INSERT INTO pick_scores (pick_id, category, points) SELECT id, ${q(cat)}, ${q(breakdown[cat])} FROM picks WHERE league_id = ${q(LEAGUE)} AND user_id = ${q(p.id)} AND round_id = ${PAST};`,
    );
  }
}

const file = join(mkdtempSync(join(tmpdir(), 'parc-ferme-seed-')), 'seed.sql');
writeFileSync(file, sql.join('\n'));
execFileSync('npx', ['wrangler', 'd1', 'execute', 'parc-ferme', '--local', '--file', file], { cwd: root, stdio: 'inherit' });

console.log(`\nSeeded league "Pit Lane Legends" (${LEAGUE}).`);
console.log('Log in as a seed player:');
for (const p of players) console.log(`  ${p.initials}  http://localhost:5173/login#${p.id}`);
console.log('Invite link:  http://localhost:5173/join/seed-invite');
console.log(`Share page:   http://localhost:8787/share/${LEAGUE}/seed-ace/${PAST}`);
