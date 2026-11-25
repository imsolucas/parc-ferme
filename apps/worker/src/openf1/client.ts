import type { Env } from '../env';

const MAX_CACHE_BYTES = 900_000; // D1 values are capped; large bodies are simply not cached
const MIN_GAP_MS = 400; // stay well under OpenF1's public rate limit

export class OpenF1Error extends Error {
  constructor(
    public status: number,
    url: string,
  ) {
    super(`OpenF1 ${status} for ${url}`);
  }
}

/**
 * OpenF1 reader with a D1-backed cache and request spacing.
 * `ttlMs` is how old a cached copy may be; pass 0 to force a refetch.
 */
export class OpenF1 {
  private lastRequest = 0;
  constructor(
    private env: Pick<Env, 'DB' | 'OPENF1_BASE'>,
    // Wrapped: calling the global `fetch` as a method of this object is an illegal invocation on Workers.
    private fetcher: (url: string, init?: RequestInit) => Promise<Response> = (url, init) => fetch(url, init),
  ) {}

  async get<T>(
    path: string,
    params: Record<string, string | number>,
    ttlMs: number,
  ): Promise<{ data: T[]; cached: boolean }> {
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const url = `${this.env.OPENF1_BASE}/${path}?${qs}`;
    const now = Date.now();

    if (ttlMs > 0) {
      const row = await this.env.DB.prepare('SELECT body, fetched_at FROM api_cache WHERE url = ?')
        .bind(url)
        .first<{ body: string; fetched_at: number }>();
      if (row && now - row.fetched_at < ttlMs) return { data: JSON.parse(row.body) as T[], cached: true };
    }

    const wait = this.lastRequest + MIN_GAP_MS - now;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequest = Date.now();

    const res = await this.fetcher(url, { headers: { accept: 'application/json' } });
    // OpenF1 answers 404 with a "no results" body for an empty query.
    if (res.status === 404) return { data: [], cached: false };
    if (!res.ok) throw new OpenF1Error(res.status, url);
    const body = await res.text();
    const data = JSON.parse(body) as unknown;
    if (!Array.isArray(data)) return { data: [], cached: false };

    if (body.length <= MAX_CACHE_BYTES) {
      await this.env.DB.prepare(
        `INSERT INTO api_cache (url, body, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(url) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at`,
      )
        .bind(url, body, Date.now())
        .run();
    }
    return { data: data as T[], cached: false };
  }
}
