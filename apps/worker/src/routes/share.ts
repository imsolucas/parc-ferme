import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../auth';
import { listDrivers, toRound, type RoundRow } from '../db';
import { renderCardPng } from '../card/render';
import { esc, CARD, type CardData } from '../card/template';
import { loadPlayers } from '../services/league';

// Public, unauthenticated routes: link scrapers need to read them.
export const share = new Hono<AppEnv>();

const CARD_STYLE_VERSION = 'v1';

async function loadCard(db: D1Database, leagueId: string, userId: string, roundId: number) {
  const [round, member] = await Promise.all([
    db.prepare('SELECT * FROM rounds WHERE id = ?').bind(roundId).first<RoundRow>(),
    db
      .prepare(
        `SELECT u.display_name AS displayName, u.initials FROM league_members m JOIN users u ON u.id = m.user_id
         WHERE m.league_id = ? AND m.user_id = ?`,
      )
      .bind(leagueId, userId)
      .first<{ displayName: string; initials: string }>(),
  ]);
  if (!round || !member) throw new HTTPException(404, { message: 'Card not found.' });

  const now = Date.now();
  // Picks stay sealed until the round locks, on the public card too.
  const revealed = now >= round.lock_at;
  const player = revealed ? (await loadPlayers(db, leagueId, roundId, userId))[0] : undefined;
  const data: Omit<CardData, 'drivers'> = { round: toRound(round, now), player: player ?? member, revealed };
  const version = [CARD_STYLE_VERSION, revealed ? 1 : 0, round.results_hash ?? '-', player?.updatedAt ?? 0, member.initials, member.displayName].join(':');
  return { data, version };
}

share.get('/card/:leagueId/:userId/:roundId', async (c) => {
  const { leagueId, userId } = c.req.param();
  const roundId = Number(c.req.param('roundId'));
  const { data, version } = await loadCard(c.env.DB, leagueId, userId, roundId);
  const headers = { 'content-type': 'image/png', 'cache-control': 'public, max-age=300', etag: `"${await etag(version)}"` };

  // Rendering is the most CPU-hungry thing this Worker does, so each version is rendered once and kept in D1.
  const hit = await c.env.DB.prepare('SELECT png FROM card_cache WHERE league_id = ? AND user_id = ? AND round_id = ? AND version = ?')
    .bind(leagueId, userId, roundId, version)
    .first<{ png: ArrayBuffer | number[] }>();
  if (hit) {
    const bytes = hit.png instanceof ArrayBuffer ? hit.png : new Uint8Array(hit.png).buffer;
    return new Response(bytes, { headers: { ...headers, 'x-card-cache': 'hit' } });
  }

  const png = await renderCardPng({ ...data, drivers: await listDrivers(c.env.DB) });
  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      `INSERT INTO card_cache (league_id, user_id, round_id, version, png, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(league_id, user_id, round_id) DO UPDATE SET version = excluded.version, png = excluded.png, created_at = excluded.created_at`,
    )
      .bind(leagueId, userId, roundId, version, png, Date.now())
      .run(),
  );
  return new Response(png, { headers: { ...headers, 'x-card-cache': 'miss' } });
});

async function etag(version: string) {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(version));
  return [...new Uint8Array(d)].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Server-rendered so scrapers (which do not run JS) see the og:image tags. */
share.get('/share/:leagueId/:userId/:roundId', async (c) => {
  const { leagueId, userId } = c.req.param();
  const roundId = Number(c.req.param('roundId'));
  const { data, version } = await loadCard(c.env.DB, leagueId, userId, roundId);
  const origin = new URL(c.req.url).origin;
  const image = `${origin}/card/${leagueId}/${userId}/${roundId}?v=${await etag(version)}`;
  const page = `${origin}/share/${leagueId}/${userId}/${roundId}`;
  const scored = data.revealed && 'total' in data.player && data.round.results?.podium;
  const title = scored
    ? `${data.player.initials} scored ${data.player.total} pts at the ${data.round.name}`
    : `${data.player.initials} is in for the ${data.round.name}`;
  const description = "PARC FERMÉ: a retro-arcade F1 pick'em league. Insert coin to play.";

  return c.html(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | PARC FERMÉ</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PARC FERMÉ">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(page)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${CARD.width}">
<meta property="og:image:height" content="${CARD.height}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:image" content="${esc(image)}">
<style>
  body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;
       background:#05050a;color:#f2f2ff;font-family:ui-monospace,Menlo,Consolas,monospace;padding:16px;box-sizing:border-box}
  img{width:100%;max-width:900px;height:auto;border:4px solid #26263a;image-rendering:auto}
  a{color:#05050a;background:#ffe600;padding:14px 22px;text-decoration:none;font-weight:700;letter-spacing:.08em}
  a:hover{background:#fff}
  @keyframes blink{50%{opacity:0}} .blink{animation:blink 1s steps(1) infinite}
  @media (prefers-reduced-motion: reduce){.blink{animation:none}}
</style>
</head>
<body>
<img src="${esc(image)}" width="${CARD.width}" height="${CARD.height}" alt="${esc(title)}">
<a href="/"><span class="blink">&#9654;</span> INSERT COIN TO PLAY</a>
</body>
</html>`);
});
