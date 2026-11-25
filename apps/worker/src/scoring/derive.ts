import type { ChaosCall, RoundResults } from '@parc-ferme/shared';
import type { OfLap, OfPosition, OfRaceControl, OfSessionResult } from '../openf1/types';

/** Pole = P1 of the qualifying classification. */
export function derivePole(quali: OfSessionResult[]): number | null {
  return quali.find((r) => r.position === 1 && !r.dsq)?.driver_number ?? null;
}

/** Fallback when `session_result` is empty: rebuild a classification from the last known positions. */
export function resultFromPositions(positions: OfPosition[]): OfSessionResult[] {
  const last = new Map<number, OfPosition>();
  for (const p of positions) {
    const prev = last.get(p.driver_number);
    if (!prev || p.date >= prev.date) last.set(p.driver_number, p);
  }
  // dnf/dns/dsq are left undefined: this endpoint cannot tell us who retired.
  return [...last.values()]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({ position: p.position, driver_number: p.driver_number }));
}

export const isRaceFinished = (raceControl: OfRaceControl[]): boolean =>
  raceControl.some((m) => m.flag === 'CHEQUERED');

export interface RaceInputs {
  result: OfSessionResult[];
  laps: OfLap[];
  raceControl: OfRaceControl[];
  /** Scheduled race start (epoch ms). Used when the laps do not carry the real start of lap 1. */
  raceStart: number;
}

type RaceResults = Pick<RoundResults, 'podium' | 'fastestLap' | 'firstDnf' | 'chaos'>;
const PENDING: RaceResults = { podium: null, fastestLap: null, firstDnf: null, chaos: null };

/**
 * Turn raw race data into scoreable results. Anything that cannot be determined stays null (pending).
 *
 * Definitions (also in the README):
 * - podium: classified P1-P3, disqualified drivers excluded.
 * - fastest lap: lowest lap time of the race; equal times all count.
 * - first DNF: retired driver(s) with the fewest completed laps; equal lap counts all count.
 *   A driver who did not start (DNS) is not a DNF, and neither is a disqualification.
 * - SAFETY_CAR / VSC: a full / virtual safety car was deployed after the start.
 * - RED_FLAG: a red flag was shown after the start.
 * - LAP1_INCIDENT: on lap 1 there was an SC, VSC, red flag, a steward "INCIDENT" note,
 *   or a driver retired without completing a lap.
 * - NO_SC: neither a full safety car nor a VSC was deployed (a red flag alone does not break it).
 */
export function deriveRace({ result, laps, raceControl, raceStart }: RaceInputs): RaceResults {
  if (!isRaceFinished(raceControl) || result.length === 0) return PENDING;

  const at = (pos: number) => result.find((r) => r.position === pos && !r.dsq)?.driver_number;
  const [a, b, c] = [at(1), at(2), at(3)];
  const podium: RaceResults['podium'] =
    a !== undefined && b !== undefined && c !== undefined ? [a, b, c] : null;

  const timed = laps.filter((l): l is OfLap & { lap_duration: number } => (l.lap_duration ?? 0) > 0);
  let fastestLap: number[] | null = null;
  if (timed.length > 0) {
    const best = Math.min(...timed.map((l) => l.lap_duration));
    fastestLap = uniqueSorted(timed.filter((l) => l.lap_duration === best).map((l) => l.driver_number));
  }

  const retirementKnown = result.every((r) => typeof r.dnf === 'boolean');
  const retired = result.filter((r) => r.dnf === true && !r.dns);
  let firstDnf: number[] | null = null;
  if (retirementKnown) {
    const fewest = Math.min(...retired.map((r) => r.number_of_laps ?? 0));
    firstDnf = uniqueSorted(
      retired.filter((r) => (r.number_of_laps ?? 0) === fewest).map((r) => r.driver_number),
    );
  }

  // Lights out = the earliest recorded start of lap 1. Messages before it (grid, formation lap)
  // are not part of the race and must not count as chaos.
  const lap1Starts = laps.filter((l) => l.lap_number === 1 && l.date_start).map((l) => Date.parse(l.date_start!));
  const start = lap1Starts.length > 0 ? Math.min(...lap1Starts) : raceStart;
  const msgs = raceControl.filter((m) => Date.parse(m.date) >= start);
  const text = (m: OfRaceControl) => (m.message ?? '').toUpperCase();
  const isVsc = (m: OfRaceControl) => /VIRTUAL SAFETY CAR DEPLOYED|VSC DEPLOYED/.test(text(m));
  const isSc = (m: OfRaceControl) => !isVsc(m) && text(m).includes('SAFETY CAR DEPLOYED');
  const isRed = (m: OfRaceControl) => m.flag === 'RED';
  const lap1 = msgs.filter((m) => (m.lap_number ?? 1) <= 1);

  const events = new Set<ChaosCall>();
  if (msgs.some(isSc)) events.add('SAFETY_CAR');
  if (msgs.some(isVsc)) events.add('VSC');
  if (msgs.some(isRed)) events.add('RED_FLAG');
  if (
    lap1.some((m) => isSc(m) || isVsc(m) || isRed(m) || text(m).includes('INCIDENT')) ||
    retired.some((r) => (r.number_of_laps ?? 0) === 0)
  ) {
    events.add('LAP1_INCIDENT');
  }
  if (!events.has('SAFETY_CAR') && !events.has('VSC')) events.add('NO_SC');

  return { podium, fastestLap, firstDnf, chaos: [...events].sort() };
}

const uniqueSorted = (xs: number[]) => [...new Set(xs)].sort((x, y) => x - y);

/** Stable fingerprint of a results object; changes exactly when the results are amended. */
export async function hashResults(results: RoundResults): Promise<string> {
  const canonical = JSON.stringify([
    results.pole,
    results.podium,
    results.fastestLap,
    results.firstDnf,
    results.chaos,
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
