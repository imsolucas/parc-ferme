// Types and constants shared by the worker (API) and the web app.

export const CHAOS_CALLS = ['SAFETY_CAR', 'RED_FLAG', 'VSC', 'LAP1_INCIDENT', 'NO_SC'] as const;
export type ChaosCall = (typeof CHAOS_CALLS)[number];

export const CHAOS_LABELS: Record<ChaosCall, string> = {
  SAFETY_CAR: 'SAFETY CAR',
  RED_FLAG: 'RED FLAG',
  VSC: 'VIRTUAL SC',
  LAP1_INCIDENT: 'LAP 1 INCIDENT',
  NO_SC: 'NO SC / VSC',
};

export const CATEGORIES = ['pole', 'p1', 'p2', 'p3', 'fastest_lap', 'first_dnf', 'chaos'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  pole: 'POLE',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
  fastest_lap: 'FASTEST LAP',
  first_dnf: 'FIRST DNF',
  chaos: 'CHAOS',
};

export const POINTS = {
  podiumExact: 5,
  podiumWrongSpot: 2,
  pole: 3,
  fastestLap: 2,
  firstDnf: 3,
  chaos: 4,
} as const;

export const MAX_ROUND_POINTS =
  POINTS.podiumExact * 3 + POINTS.pole + POINTS.fastestLap + POINTS.firstDnf + POINTS.chaos;

/** One player's picks for a round. Driver fields are car numbers. */
export interface Picks {
  pole: number;
  p1: number;
  p2: number;
  p3: number;
  fastestLap: number;
  firstDnf: number;
  chaos: ChaosCall;
}

/**
 * What actually happened. `null` means "not known yet" (scores stay pending);
 * an empty array means "known, and nobody qualifies" (e.g. a race with no DNF).
 */
export interface RoundResults {
  pole: number | null;
  podium: [number, number, number] | null;
  /** Every driver who shares the fastest lap time. */
  fastestLap: number[] | null;
  /** Every driver who retired on the earliest retirement lap. */
  firstDnf: number[] | null;
  /** Every chaos call that came true. */
  chaos: ChaosCall[] | null;
}

/** Points per category; null = pending (result not known yet). */
export type ScoreBreakdown = Record<Category, number | null>;

export interface Driver {
  number: number;
  acronym: string;
  fullName: string;
  team: string;
  /** Hex without '#'. */
  colour: string;
}

export type RoundStatus = 'open' | 'locked' | 'scored';

export interface Round {
  id: number;
  season: number;
  name: string;
  location: string;
  country: string;
  lockAt: number; // epoch ms, qualifying start
  raceStart: number; // epoch ms
  status: RoundStatus;
  results: RoundResults | null;
}

export interface Member {
  userId: string;
  displayName: string;
  initials: string;
}

export interface League {
  id: string;
  name: string;
  season: number;
  inviteToken?: string;
  members: Member[];
}

export interface LeaderboardRow extends Member {
  rank: number;
  points: number;
  /** Rounds with at least one scored category. */
  rounds: number;
}

export interface PlayerRound extends Member {
  picks: Picks;
  breakdown: ScoreBreakdown;
  total: number;
}

export interface RoundDetail {
  round: Round;
  myPicks: Picks | null;
  /** Everyone's picks; only populated once the round is locked. */
  players: PlayerRound[];
}

export interface Me {
  userId: string;
  displayName: string;
  initials: string;
  leagues: { id: string; name: string; season: number }[];
}

export interface SessionGrant {
  token: string;
  userId: string;
  leagueId: string;
}

export const INITIALS_RE = /^[A-Z0-9]{3}$/;
