import {
  CATEGORIES,
  type Category,
  type LeaderboardRow,
  type PlayerRound,
  type ScoreBreakdown,
} from '@parc-ferme/shared';
import { toPicks, type PickRow } from '../db';
import { totalPoints } from '../scoring/score';

type PlayerPickRow = PickRow & { display_name: string; initials: string; updated_at: number };

const pendingBreakdown = (): ScoreBreakdown =>
  Object.fromEntries(CATEGORIES.map((c) => [c, null])) as ScoreBreakdown;

/** Picks + stored per-category points for a league round (optionally one player). */
export async function loadPlayers(
  db: D1Database,
  leagueId: string,
  roundId: number,
  userId?: string,
): Promise<(PlayerRound & { updatedAt: number })[]> {
  const who = userId ? 'AND p.user_id = ?3' : '';
  const args = userId ? [leagueId, roundId, userId] : [leagueId, roundId];
  const [picks, scores] = await db.batch([
    db
      .prepare(
        `SELECT p.*, u.display_name, u.initials FROM picks p JOIN users u ON u.id = p.user_id
         WHERE p.league_id = ?1 AND p.round_id = ?2 ${who}`,
      )
      .bind(...args),
    db
      .prepare(
        `SELECT ps.pick_id, ps.category, ps.points FROM pick_scores ps JOIN picks p ON p.id = ps.pick_id
         WHERE p.league_id = ?1 AND p.round_id = ?2 ${who}`,
      )
      .bind(...args),
  ]);

  const byPick = new Map<number, ScoreBreakdown>();
  for (const s of (scores?.results ?? []) as { pick_id: number; category: Category; points: number | null }[]) {
    const b = byPick.get(s.pick_id) ?? pendingBreakdown();
    b[s.category] = s.points;
    byPick.set(s.pick_id, b);
  }

  return ((picks?.results ?? []) as PlayerPickRow[])
    .map((p) => {
      const breakdown = byPick.get(p.id) ?? pendingBreakdown();
      return {
        userId: p.user_id,
        displayName: p.display_name,
        initials: p.initials,
        picks: toPicks(p),
        breakdown,
        total: totalPoints(breakdown),
        updatedAt: p.updated_at,
      };
    })
    .sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName));
}

/** Season table, or a single round's table when `roundId` is given. Ties share a rank. */
export async function leaderboard(
  db: D1Database,
  leagueId: string,
  season: number,
  roundId?: number,
): Promise<LeaderboardRow[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id AS userId, u.display_name AS displayName, u.initials,
              COALESCE(SUM(ps.points), 0) AS points,
              COUNT(DISTINCT CASE WHEN ps.points IS NOT NULL THEN p.round_id END) AS rounds
       FROM league_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN picks p ON p.league_id = m.league_id AND p.user_id = m.user_id
            AND p.round_id IN (SELECT id FROM rounds WHERE season = ?2 AND (?3 IS NULL OR id = ?3))
       LEFT JOIN pick_scores ps ON ps.pick_id = p.id
       WHERE m.league_id = ?1
       GROUP BY u.id
       ORDER BY points DESC, m.joined_at`,
    )
    .bind(leagueId, season, roundId ?? null)
    .all<Omit<LeaderboardRow, 'rank'>>();

  let rank = 0;
  let prev: number | null = null;
  return results.map((r, i) => {
    if (r.points !== prev) rank = i + 1;
    prev = r.points;
    return { ...r, rank };
  });
}
