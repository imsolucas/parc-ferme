import { describe, expect, it } from 'vitest';
import { CATEGORIES, MAX_ROUND_POINTS } from '@parc-ferme/shared';
import { scorePicks, totalPoints } from '../src/scoring/score';
import { picks, results } from './helpers';

describe('scorePicks', () => {
  it('awards the maximum for a perfect card', () => {
    const b = scorePicks(picks(), results());
    expect(b).toEqual({ pole: 3, p1: 5, p2: 5, p3: 5, fastest_lap: 2, first_dnf: 3, chaos: 4 });
    expect(totalPoints(b)).toBe(MAX_ROUND_POINTS);
    expect(MAX_ROUND_POINTS).toBe(27);
  });

  it('gives 5 for an exact podium slot and 2 for a podium driver in the wrong slot', () => {
    const b = scorePicks(picks({ p1: 2, p2: 1, p3: 3 }), results());
    expect([b.p1, b.p2, b.p3]).toEqual([2, 2, 5]);
  });

  it('gives 0 for a podium pick who finished off the podium', () => {
    const b = scorePicks(picks({ p1: 44, p2: 2, p3: 16 }), results());
    expect([b.p1, b.p2, b.p3]).toEqual([0, 5, 0]);
  });

  it('scores every category as 0 for a completely wrong card', () => {
    const b = scorePicks(
      picks({ pole: 9, p1: 7, p2: 8, p3: 9, fastestLap: 9, firstDnf: 9, chaos: 'RED_FLAG' }),
      results(),
    );
    expect(totalPoints(b)).toBe(0);
    expect(Object.values(b).every((v) => v === 0)).toBe(true);
  });

  it('never lets one driver score twice on the podium', () => {
    // Duplicate podium picks are rejected by the API; the scorer still must not double-dip.
    const b = scorePicks(picks({ p1: 1, p2: 1, p3: 1 }), results());
    expect([b.p1, b.p2, b.p3]).toEqual([5, 0, 0]);
    const wrongSpotTwice = scorePicks(picks({ p1: 3, p2: 3, p3: 9 }), results());
    expect([wrongSpotTwice.p1, wrongSpotTwice.p2, wrongSpotTwice.p3]).toEqual([2, 0, 0]);
  });

  describe('missing results', () => {
    it('marks everything pending (null, not 0) when there are no results at all', () => {
      const b = scorePicks(picks(), null);
      expect(CATEGORIES.every((c) => b[c] === null)).toBe(true);
      expect(totalPoints(b)).toBe(0);
    });

    it('scores pole after qualifying while race categories stay pending', () => {
      const b = scorePicks(picks(), { pole: 1, podium: null, fastestLap: null, firstDnf: null, chaos: null });
      expect(b).toEqual({ pole: 3, p1: null, p2: null, p3: null, fastest_lap: null, first_dnf: null, chaos: null });
    });

    it('keeps a single unknown category pending without affecting the others', () => {
      const b = scorePicks(picks(), results({ fastestLap: null }));
      expect(b.fastest_lap).toBeNull();
      expect(totalPoints(b)).toBe(MAX_ROUND_POINTS - 2);
    });
  });

  describe('ties', () => {
    it('pays every driver who shares the fastest lap', () => {
      const tied = results({ fastestLap: [1, 4] });
      expect(scorePicks(picks({ fastestLap: 1 }), tied).fastest_lap).toBe(2);
      expect(scorePicks(picks({ fastestLap: 4 }), tied).fastest_lap).toBe(2);
      expect(scorePicks(picks({ fastestLap: 16 }), tied).fastest_lap).toBe(0);
    });

    it('pays every driver who retired on the same first lap', () => {
      const tied = results({ firstDnf: [20, 31] });
      expect(scorePicks(picks({ firstDnf: 31 }), tied).first_dnf).toBe(3);
    });
  });

  describe('DNF edge cases', () => {
    it('scores 0 (not pending) when the race had no retirements', () => {
      expect(scorePicks(picks(), results({ firstDnf: [] })).first_dnf).toBe(0);
    });

    it('does not pay a pick on a driver who did not start', () => {
      // Car 23 was DNS, car 20 was the first real retirement.
      expect(scorePicks(picks({ firstDnf: 23 }), results({ firstDnf: [20] })).first_dnf).toBe(0);
    });
  });

  describe('chaos call', () => {
    it('pays when the called event is among those that happened', () => {
      const r = results({ chaos: ['LAP1_INCIDENT', 'SAFETY_CAR', 'VSC'] });
      expect(scorePicks(picks({ chaos: 'VSC' }), r).chaos).toBe(4);
      expect(scorePicks(picks({ chaos: 'NO_SC' }), r).chaos).toBe(0);
    });
  });

  describe('amended results', () => {
    it('is deterministic: the same inputs always give the same breakdown', () => {
      expect(scorePicks(picks(), results())).toEqual(scorePicks(picks(), results()));
    });

    it('re-scores cleanly when the winner is disqualified after the race', () => {
      const card = picks({ p1: 1, p2: 2, p3: 3 });
      const before = scorePicks(card, results({ podium: [1, 2, 3] }));
      const after = scorePicks(card, results({ podium: [2, 3, 4] }));
      expect([before.p1, before.p2, before.p3]).toEqual([5, 5, 5]);
      expect([after.p1, after.p2, after.p3]).toEqual([0, 2, 2]);
      // Categories untouched by the amendment keep their points.
      expect(after.pole).toBe(before.pole);
      expect(after.chaos).toBe(before.chaos);
    });

    it('can take points away again (no ratchet)', () => {
      const card = picks({ fastestLap: 1 });
      expect(scorePicks(card, results({ fastestLap: [1] })).fastest_lap).toBe(2);
      expect(scorePicks(card, results({ fastestLap: [4] })).fastest_lap).toBe(0);
    });
  });
});
