import { POINTS, type Picks, type RoundResults, type ScoreBreakdown } from '@parc-ferme/shared';

/**
 * Pure scoring: picks + results -> points per category.
 *
 * - A category whose result is not known yet scores `null` (pending), never 0.
 * - Podium: 5 for the exact position, 2 for a podium driver in the wrong slot.
 *   A driver can only score once, so a (normally rejected) duplicate pick cannot double-dip.
 * - Fastest lap / first DNF: any driver in the tied set counts.
 * - Deterministic and side-effect free, so re-running it after amended results is safe.
 */
export function scorePicks(picks: Picks, results: RoundResults | null): ScoreBreakdown {
  const r = results ?? { pole: null, podium: null, fastestLap: null, firstDnf: null, chaos: null };

  const podiumPicks = [picks.p1, picks.p2, picks.p3] as const;
  let podiumPoints: (number | null)[] = [null, null, null];
  if (r.podium) {
    const actual = r.podium;
    const scored = new Set<number>();
    podiumPoints = [0, 0, 0];
    podiumPicks.forEach((driver, i) => {
      if (actual[i] === driver) {
        podiumPoints[i] = POINTS.podiumExact;
        scored.add(driver);
      }
    });
    podiumPicks.forEach((driver, i) => {
      if (podiumPoints[i] === 0 && actual.includes(driver) && !scored.has(driver)) {
        podiumPoints[i] = POINTS.podiumWrongSpot;
        scored.add(driver);
      }
    });
  }

  return {
    pole: r.pole === null ? null : r.pole === picks.pole ? POINTS.pole : 0,
    p1: podiumPoints[0] ?? null,
    p2: podiumPoints[1] ?? null,
    p3: podiumPoints[2] ?? null,
    fastest_lap:
      r.fastestLap === null ? null : r.fastestLap.includes(picks.fastestLap) ? POINTS.fastestLap : 0,
    first_dnf: r.firstDnf === null ? null : r.firstDnf.includes(picks.firstDnf) ? POINTS.firstDnf : 0,
    chaos: r.chaos === null ? null : r.chaos.includes(picks.chaos) ? POINTS.chaos : 0,
  };
}

export function totalPoints(b: ScoreBreakdown): number {
  return Object.values(b).reduce<number>((sum, p) => sum + (p ?? 0), 0);
}
