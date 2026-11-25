import { describe, expect, it } from 'vitest';
import type { OfLap, OfRaceControl, OfSessionResult } from '../src/openf1/types';
import { derivePole, deriveRace, hashResults, resultFromPositions } from '../src/scoring/derive';
import { CHEQUERED, RACE_START, fixture, lap, rc, row } from './helpers';

const base = () => ({
  result: [row(1, 1), row(2, 2), row(3, 3), row(4, 4)],
  laps: [lap(1, 5, 90.5), lap(2, 5, 91), lap(3, 5, 92)],
  raceControl: [CHEQUERED],
  raceStart: RACE_START,
});

describe('real fixture: 2026 Las Vegas Grand Prix', () => {
  const race = deriveRace({
    result: fixture<OfSessionResult[]>('race_result'),
    laps: fixture<OfLap[]>('laps'),
    raceControl: fixture<OfRaceControl[]>('race_control'),
    raceStart: RACE_START,
  });

  it('reads pole from the qualifying classification', () => {
    expect(derivePole(fixture<OfSessionResult[]>('quali_result'))).toBe(12);
  });
  it('reads the podium', () => expect(race.podium).toEqual([3, 1, 81]));
  it('finds the fastest lap', () => expect(race.fastestLap).toEqual([30]));
  it('picks the earliest retirement and ignores the DNS car', () => {
    // 11 retired after 17 laps, 41 after 19, 14 after 49; 23 did not start.
    expect(race.firstDnf).toEqual([11]);
  });
  it('detects the safety car and therefore rules out NO_SC', () => {
    expect(race.chaos).toContain('SAFETY_CAR');
    expect(race.chaos).not.toContain('NO_SC');
    expect(race.chaos).not.toContain('VSC');
    expect(race.chaos).not.toContain('RED_FLAG');
  });
});

describe('missing results', () => {
  it('stays pending until the chequered flag, even if a classification exists', () => {
    expect(deriveRace({ ...base(), raceControl: [rc('SAFETY CAR DEPLOYED', { category: 'SafetyCar' })] })).toEqual({
      podium: null,
      fastestLap: null,
      firstDnf: null,
      chaos: null,
    });
  });

  it('stays pending when the classification is empty', () => {
    expect(deriveRace({ ...base(), result: [] }).podium).toBeNull();
  });

  it('leaves the podium pending when a top-3 position is missing', () => {
    expect(deriveRace({ ...base(), result: [row(1, 1), row(2, 2)] }).podium).toBeNull();
  });

  it('leaves fastest lap pending when no lap times were published', () => {
    const r = deriveRace({ ...base(), laps: [lap(1, 1, null)] });
    expect(r.fastestLap).toBeNull();
    expect(r.podium).toEqual([1, 2, 3]);
  });

  it('returns no pole for an empty qualifying result', () => expect(derivePole([])).toBeNull());
});

describe('DNS / DNF', () => {
  it('does not count a DNS as the first DNF', () => {
    const result = [...base().result, row(null, 23, { dns: true, number_of_laps: 0 }), row(null, 20, { dnf: true, number_of_laps: 12 })];
    expect(deriveRace({ ...base(), result }).firstDnf).toEqual([20]);
  });

  it('reports an empty set when the only non-finisher was a DNS', () => {
    const result = [...base().result, row(null, 23, { dns: true, number_of_laps: 0 })];
    const r = deriveRace({ ...base(), result });
    expect(r.firstDnf).toEqual([]);
    expect(r.chaos).not.toContain('LAP1_INCIDENT');
  });

  it('treats retirements on the same lap as a tie', () => {
    const result = [...base().result, row(null, 20, { dnf: true, number_of_laps: 0 }), row(null, 31, { dnf: true, number_of_laps: 0 }), row(null, 18, { dnf: true, number_of_laps: 30 })];
    const r = deriveRace({ ...base(), result });
    expect(r.firstDnf).toEqual([20, 31]);
    expect(r.chaos).toContain('LAP1_INCIDENT');
  });

  it('does not count a disqualification as a DNF, and removes the driver from the podium', () => {
    const result = [row(1, 1, { dsq: true }), row(1, 2), row(2, 3), row(3, 4)];
    const r = deriveRace({ ...base(), result });
    expect(r.podium).toEqual([2, 3, 4]);
    expect(r.firstDnf).toEqual([]);
  });
});

describe('tied fastest lap', () => {
  it('returns every driver on the identical best time', () => {
    const laps = [lap(1, 5, 90.123), lap(4, 9, 90.123), lap(2, 5, 90.124), lap(1, 6, 95)];
    expect(deriveRace({ ...base(), laps }).fastestLap).toEqual([1, 4]);
  });
});

describe('chaos calls', () => {
  const chaos = (...msgs: OfRaceControl[]) => deriveRace({ ...base(), raceControl: [...msgs, CHEQUERED] }).chaos;

  it('a clean race is NO_SC only', () => expect(chaos()).toEqual(['NO_SC']));
  it('tells a VSC from a full safety car', () => {
    expect(chaos(rc('VIRTUAL SAFETY CAR DEPLOYED', { category: 'SafetyCar' }))).toEqual(['VSC']);
    expect(chaos(rc('SAFETY CAR DEPLOYED', { category: 'SafetyCar' }))).toEqual(['SAFETY_CAR']);
  });
  it('a red flag alone does not break NO_SC', () => {
    expect(chaos(rc('RED FLAG', { category: 'Flag', flag: 'RED' }))).toEqual(['NO_SC', 'RED_FLAG']);
  });
  it('flags a lap 1 incident', () => {
    expect(chaos(rc('TURN 1 INCIDENT INVOLVING CARS 1 (NOR) AND 4 (XXX) NOTED', { lap_number: 1 }))).toEqual(['LAP1_INCIDENT', 'NO_SC']);
  });
  it('anchors on the real start of lap 1 when lap data has it (formation lap excluded)', () => {
    const laps = [{ ...lap(1, 1, 100), date_start: '2026-11-22T04:03:46+00:00' }, lap(1, 5, 90)];
    const formation = rc('INCIDENT ON THE FORMATION LAP', { lap_number: 1, date: '2026-11-22T04:01:00+00:00' });
    expect(deriveRace({ ...base(), laps, raceControl: [formation, CHEQUERED] }).chaos).toEqual(['NO_SC']);
  });
  it('ignores messages from before the scheduled start when lap 1 has no timestamp', () => {
    expect(chaos(rc('INCIDENT ON THE GRID', { lap_number: 1, date: '2026-11-22T03:40:00+00:00' }))).toEqual(['NO_SC']);
  });
});

describe('position fallback', () => {
  const positions = [
    { driver_number: 1, position: 2, date: '2026-11-22T04:00:00+00:00' },
    { driver_number: 4, position: 1, date: '2026-11-22T04:00:00+00:00' },
    { driver_number: 1, position: 1, date: '2026-11-22T05:30:00+00:00' },
    { driver_number: 4, position: 2, date: '2026-11-22T05:30:00+00:00' },
    { driver_number: 16, position: 3, date: '2026-11-22T04:00:00+00:00' },
  ];
  it('uses each driver’s final position', () => {
    expect(resultFromPositions(positions).map((r) => [r.position, r.driver_number])).toEqual([[1, 1], [2, 4], [3, 16]]);
  });
  it('gives a podium but leaves first DNF pending, since retirements are unknown', () => {
    const r = deriveRace({ ...base(), result: resultFromPositions(positions) });
    expect(r.podium).toEqual([1, 4, 16]);
    expect(r.firstDnf).toBeNull();
  });
});

describe('amended results', () => {
  const full = (podium: [number, number, number]) => ({ pole: 1, podium, fastestLap: [1], firstDnf: [], chaos: ['NO_SC' as const] });
  it('hash is stable for identical results and changes when they are amended', async () => {
    expect(await hashResults(full([1, 2, 3]))).toBe(await hashResults(full([1, 2, 3])));
    expect(await hashResults(full([1, 2, 3]))).not.toBe(await hashResults(full([2, 3, 4])));
  });
});
