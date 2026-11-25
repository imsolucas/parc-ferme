import { MINUTE, type Env } from '../env';
import { sendPush, type Vapid } from '../push/webpush';

type Kind = 'LOCK_T60' | 'LOCK_T10' | 'RESULTS';
interface JobRow {
  round_id: number;
  kind: Kind;
  cursor: number;
  name: string;
  lock_at: number;
}
interface SubRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Push sends are subrequests and the free plan allows 50 per invocation, so fan-out is paged across
 * ticks. 30 leaves headroom for this tick's own D1 calls.
 */
const SENDS_PER_TICK = 30;
const SLACK = 30_000; // cron ticks do not land exactly on the minute

/** Create reminder jobs for rounds about to lock. The (round, kind) primary key makes each fire once. */
export async function queueLockReminders(env: Env, now: number) {
  const { results } = await env.DB.prepare('SELECT id, lock_at FROM rounds WHERE lock_at > ? AND lock_at <= ?')
    .bind(now, now + 60 * MINUTE + SLACK)
    .all<{ id: number; lock_at: number }>();
  for (const r of results) {
    const kind: Kind = r.lock_at - now <= 10 * MINUTE + SLACK ? 'LOCK_T10' : 'LOCK_T60';
    await env.DB.prepare('INSERT OR IGNORE INTO notification_jobs (round_id, kind, created_at) VALUES (?, ?, ?)')
      .bind(r.id, kind, now)
      .run();
  }
}

export function buildMessage(kind: Kind, roundName: string, lockAt: number, now: number) {
  const mins = Math.max(1, Math.round((lockAt - now) / MINUTE));
  if (kind === 'RESULTS') {
    return { title: 'RESULTS ARE IN', body: `${roundName}: scores are up. Check the high score table.`, url: '/' };
  }
  return {
    title: kind === 'LOCK_T10' ? 'FINAL CALL' : 'PICKS LOCK SOON',
    body: `${roundName}: picks lock in ${mins} min. Insert coin.`,
    url: '/',
  };
}

/** Work through pending jobs, at most SENDS_PER_TICK pushes per invocation. */
export async function processNotificationJobs(env: Env, now: number, fetcher: typeof fetch = fetch) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { sent: 0, removed: 0, skipped: 'no VAPID keys' };
  const vapid: Vapid = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };

  const { results: jobs } = await env.DB.prepare(
    `SELECT j.round_id, j.kind, j.cursor, r.name, r.lock_at
     FROM notification_jobs j JOIN rounds r ON r.id = j.round_id
     WHERE j.done = 0 ORDER BY j.created_at LIMIT 5`,
  ).all<JobRow>();

  let budget = SENDS_PER_TICK;
  const jwtCache = new Map<string, Promise<string>>();
  let sent = 0;
  let removed = 0;
  for (const job of jobs) {
    const finish = () =>
      env.DB.prepare('UPDATE notification_jobs SET done = 1 WHERE round_id = ? AND kind = ?')
        .bind(job.round_id, job.kind)
        .run();
    // A lock reminder is pointless once the round has locked.
    if (job.kind !== 'RESULTS' && now >= job.lock_at) {
      await finish();
      continue;
    }
    if (budget <= 0) break;

    const { results: subs } = await env.DB.prepare(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE id > ? ORDER BY id LIMIT ?',
    )
      .bind(job.cursor, budget)
      .all<SubRow>();

    const message = buildMessage(job.kind, job.name, job.lock_at, now);
    const outcomes = await Promise.all(
      subs.map((s) =>
        sendPush(s, message, vapid, { ttl: job.kind === 'RESULTS' ? 6 * 3600 : 600, urgency: 'high', fetcher, jwtCache })
          .then((r) => ({ id: s.id, gone: r.gone, ok: r.status < 300 }))
          .catch(() => ({ id: s.id, gone: false, ok: false })),
      ),
    );
    budget -= subs.length;
    sent += outcomes.filter((o) => o.ok).length;

    // 410 Gone / 404: the browser unsubscribed, so the row is dead weight.
    const dead = outcomes.filter((o) => o.gone).map((o) => o.id);
    if (dead.length > 0) {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE id IN (SELECT value FROM json_each(?))')
        .bind(JSON.stringify(dead))
        .run();
      removed += dead.length;
    }

    const last = subs[subs.length - 1];
    if (last) {
      await env.DB.prepare('UPDATE notification_jobs SET cursor = ? WHERE round_id = ? AND kind = ?')
        .bind(last.id, job.round_id, job.kind)
        .run();
    }
    if (budget > 0) await finish(); // fewer rows than asked for: this job is drained
  }
  return { sent, removed };
}
