import { describe, expect, it } from 'vitest';
import type { OfMeeting, OfSession } from '../src/openf1/types';
import { buildRounds } from '../src/services/sync';

const meeting = (key: number, name: string, over: Partial<OfMeeting> = {}): OfMeeting => ({
  meeting_key: key, meeting_name: name, location: 'X', country_name: 'Y', year: 2026, ...over,
});
const session = (meeting_key: number, session_name: string, start: string): OfSession => ({
  session_key: meeting_key * 10 + session_name.length, meeting_key, session_name,
  session_type: session_name.includes('Qualifying') ? 'Qualifying' : 'Race',
  date_start: start, date_end: start.replace('T14', 'T15'),
});

describe('buildRounds', () => {
  const rows = buildRounds(
    [meeting(1, 'Pre-Season Testing'), meeting(2, 'Sprint Grand Prix'), meeting(3, 'Cancelled Grand Prix', { is_cancelled: true }), meeting(4, 'No Quali Yet Grand Prix')],
    [
      session(2, 'Sprint Qualifying', '2026-05-01T14:00:00+00:00'),
      session(2, 'Sprint', '2026-05-02T14:00:00+00:00'),
      session(2, 'Qualifying', '2026-05-02T18:00:00+00:00'),
      session(2, 'Race', '2026-05-03T14:00:00+00:00'),
      session(3, 'Qualifying', '2026-06-02T14:00:00+00:00'),
      session(3, 'Race', '2026-06-03T14:00:00+00:00'),
      session(4, 'Race', '2026-07-03T14:00:00+00:00'),
    ],
  );

  it('skips testing, cancelled meetings and weekends without both sessions', () => {
    expect(rows.map((r) => r[0])).toEqual([2]);
  });
  it('locks at the Grand Prix qualifying start, not sprint qualifying', () => {
    expect(rows[0]![7]).toBe(Date.parse('2026-05-02T18:00:00Z'));
  });
});
