import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './auth';
import { DAY, type Env } from './env';
import { OpenF1 } from './openf1/client';
import { api } from './routes/api';
import { share } from './routes/share';
import { processNotificationJobs, queueLockReminders } from './services/notify';
import { scoreDueRounds } from './services/results';
import { syncCalendar } from './services/sync';

const app = new Hono<AppEnv>();

app.route('/api', api);
app.route('/', share);

// Anything else is the PWA (static assets with SPA fallback).
app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Not found.' }, 404) : c.env.ASSETS.fetch(c.req.raw)));

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Something went wrong on our side.' }, 500);
});

/** Every 15 minutes: calendar sync (cached 6h), then fetch results for finished sessions and score. */
async function tickScoring(env: Env, now: number) {
  const of = new OpenF1(env);
  const sync = await syncCalendar(env, of, now).catch((e) => ({ error: String(e) }));
  const scored = await scoreDueRounds(env, of, now).catch((e) => ({ error: String(e) }));
  await env.DB.prepare('DELETE FROM api_cache WHERE fetched_at < ?').bind(now - 7 * DAY).run();
  console.log(JSON.stringify({ tick: 'scoring', sync, scored }));
}

/** Every 5 minutes: queue T-60 / T-10 lock reminders and deliver pending pushes (incl. "results in"). */
async function tickNotifications(env: Env, now: number) {
  await queueLockReminders(env, now);
  const pushed = await processNotificationJobs(env, now);
  console.log(JSON.stringify({ tick: 'notifications', pushed }));
}

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    const now = event.scheduledTime || Date.now();
    ctx.waitUntil(event.cron === '*/15 * * * *' ? tickScoring(env, now) : tickNotifications(env, now));
  },
} satisfies ExportedHandler<Env>;
