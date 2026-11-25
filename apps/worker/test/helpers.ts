import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Picks, RoundResults } from '@parc-ferme/shared';
import type { OfLap, OfRaceControl, OfSessionResult } from '../src/openf1/types';

/** Real OpenF1 responses (trimmed) for the 2026 Las Vegas Grand Prix. */
export const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', `${name}.json`), 'utf8')) as T;

export const RACE_START = Date.parse('2026-11-22T04:00:00Z');

export const picks = (over: Partial<Picks> = {}): Picks => ({
  pole: 1,
  p1: 1,
  p2: 2,
  p3: 3,
  fastestLap: 1,
  firstDnf: 20,
  chaos: 'SAFETY_CAR',
  ...over,
});

export const results = (over: Partial<RoundResults> = {}): RoundResults => ({
  pole: 1,
  podium: [1, 2, 3],
  fastestLap: [1],
  firstDnf: [20],
  chaos: ['SAFETY_CAR'],
  ...over,
});

export const row = (position: number | null, driver: number, over: Partial<OfSessionResult> = {}): OfSessionResult => ({
  position,
  driver_number: driver,
  number_of_laps: 50,
  dnf: false,
  dns: false,
  dsq: false,
  ...over,
});

export const lap = (driver: number, n: number, duration: number | null): OfLap => ({
  driver_number: driver,
  lap_number: n,
  lap_duration: duration,
});

export const rc = (message: string, over: Partial<OfRaceControl> = {}): OfRaceControl => ({
  date: '2026-11-22T04:30:00+00:00',
  lap_number: 10,
  category: 'Other',
  flag: null,
  message,
  ...over,
});

export const CHEQUERED = rc('CHEQUERED FLAG', { category: 'Flag', flag: 'CHEQUERED', lap_number: 50 });
