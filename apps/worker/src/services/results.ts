import { CATEGORIES, type RoundResults } from '@parc-ferme/shared';
import { DAY, HOUR, MINUTE, type Env } from '../env';
import { EMPTY_RESULTS, isComplete, parseResults, toPicks, type PickRow, type RoundRow } from '../db';
import type { OpenF1 } from '../openf1/client';
import type { OfLap, OfPosition, OfRaceControl, OfSessionResult } from '../openf1/types';
import { derivePole, deriveRace, hashResults, isRaceFinished, resultFromPositions } from '../scoring/derive';
import { scorePicks } from '../scoring/score';

const RECHECK_INCOMPLETE = 14 * MINUTE; // every 15-minute tick until results are in
const RECHECK_COMPLETE = HOUR; // then hourly, to catch stewards' amendments
const AMEND_WINDOW = 4 * DAY;
const MAX_ROUNDS_PER_TICK = 2;

/** Cron entry: find rounds whose sessions have finished, fetch results, score. */
export async function scoreDueRounds(env: Env, of: OpenF1, now: number) {
  const { results: rounds } = await env.DB.prepare(
    `SELECT * FROM rounds
     WHERE quali_session_key IS NOT NULL AND quali_end <= ?1 AND race_start > ?2
     ORDER BY lock_at DESC LIMIT 6`,
  )
    .bind(now, now - AMEND_WINDOW)
    .all<RoundRow>();

  const out: { round: number; changed: boolean }[] = [];
  for (const round of rounds) {
    if (out.length >= MAX_ROUNDS_PER_TICK) break;
    const gap = isComplete(parseResults(round)) ? RECHECK_COMPLETE : RECHECK_INCOMPLETE;
    if (round.results_checked_at && now - round.results_checked_at < gap) continue;
    out.push({ round: round.id, changed: (await refreshRound(env, of, round, now)).changed });
  }
  return out;
}

/**
 * Fetch whatever results exist for a round and (re)score it.
 * Idempotent: scores are derived from scratch and upserted, so running it twice,
 * or again after amended results, always converges on the same rows.
 */
export async function refreshRound(env: Env, of: OpenF1, round: RoundRow, now: number, force = false) {
  const previous = parseResults(round) ?? EMPTY_RESULTS;
  const results: RoundResults = { ...previous };

  if (round.quali_session_key !== null && now >= round.quali_end) {
    const quali = await classification(of, round.quali_session_key);
    const pole = derivePole(quali);
    if (pole !== null) results.pole = pole;
  }

  // Races can overrun their slot, so the chequered flag (not the clock) says when it is over.
  if (round.race_session_key !== null && now >= round.race_start + 45 * MINUTE) {
    const key = round.race_session_key;
    const raceControl = (await of.get<OfRaceControl>('race_control', { session_key: key }, 0)).data;
    if (isRaceFinished(raceControl)) {
      const result = await classification(of, key);
      const laps = (await of.get<OfLap>('laps', { session_key: key }, 0)).data;
      const race = deriveRace({ result, laps, raceControl, raceStart: round.race_start });
      // Only overwrite with something known: a flaky empty response must not wipe real results.
      if (race.podium) results.podium = race.podium;
      if (race.fastestLap) results.fastestLap = race.fastestLap;
      if (race.firstDnf) results.firstDnf = race.firstDnf;
      if (race.chaos) results.chaos = race.chaos;
    }
  }

  const hash = await hashResults(results);
  const changed = hash !== round.results_hash;
  if (changed || force) {
    await env.DB.prepare(
      'UPDATE rounds SET results_json = ?, results_hash = ?, results_checked_at = ?, scored_at = ? WHERE id = ?',
    )
      .bind(JSON.stringify(results), hash, now, now, round.id)
      .run();
    await scoreRound(env.DB, round.id, results);
    // "Results in" goes out once per round: the primary key swallows repeats and amendments.
    if (results.podium) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO notification_jobs (round_id, kind, created_at) VALUES (?, 'RESULTS', ?)",
      )
        .bind(round.id, now)
        .run();
    }
  } else {
    await env.DB.prepare('UPDATE rounds SET results_checked_at = ? WHERE id = ?').bind(now, round.id).run();
  }
  return { changed, results };
}

/** session_result, falling back to the last known `position` per driver. */
async function classification(of: OpenF1, sessionKey: number): Promise<OfSessionResult[]> {
  const res = (await of.get<OfSessionResult>('session_result', { session_key: sessionKey }, 0)).data;
  if (res.length > 0) return res;
  const pos = (await of.get<OfPosition>('position', { session_key: sessionKey }, 0)).data;
  return resultFromPositions(pos);
}

/** Recompute and upsert the per-category points of every pick in a round. */
export async function scoreRound(db: D1Database, roundId: number, results: RoundResults | null) {
  const PAGE = 1000;
  let after = 0;
  let scored = 0;
  for (;;) {
    const { results: picks } = await db
      .prepare('SELECT * FROM picks WHERE round_id = ? AND id > ? ORDER BY id LIMIT ?')
      .bind(roundId, after, PAGE)
      .all<PickRow>();
    if (picks.length === 0) break;

    const rows: [number, string, number | null][] = [];
    for (const pick of picks) {
      const breakdown = scorePicks(toPicks(pick), results);
      for (const cat of CATEGORIES) rows.push([pick.id, cat, breakdown[cat]]);
    }
    // A single statement per page keeps this inside the free tier's per-invocation query budget.
    await db
      .prepare(
        `INSERT INTO pick_scores (pick_id, category, points)
         SELECT value->>0, value->>1, value->>2 FROM json_each(?) WHERE true
         ON CONFLICT(pick_id, category) DO UPDATE SET points = excluded.points`,
      )
      .bind(JSON.stringify(rows))
      .run();

    scored += picks.length;
    after = picks[picks.length - 1]!.id;
    if (picks.length < PAGE) break;
  }
  return scored;
}
