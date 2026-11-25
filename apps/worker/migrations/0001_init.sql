-- PARC FERMÉ initial schema. All timestamps are epoch milliseconds (UTC).

CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  initials     TEXT NOT NULL CHECK (length(initials) = 3),
  token_hash   TEXT NOT NULL UNIQUE,          -- SHA-256 of the device session token
  created_at   INTEGER NOT NULL
);

CREATE TABLE leagues (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  season       INTEGER NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  owner_id     TEXT NOT NULL REFERENCES users(id),
  created_at   INTEGER NOT NULL
);

CREATE TABLE league_members (
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (league_id, user_id)
);
CREATE INDEX idx_members_user ON league_members(user_id);

-- One row per Grand Prix weekend. id = OpenF1 meeting_key.
CREATE TABLE rounds (
  id                INTEGER PRIMARY KEY,
  season            INTEGER NOT NULL,
  name              TEXT NOT NULL,
  location          TEXT NOT NULL,
  country           TEXT NOT NULL,
  quali_session_key INTEGER,                  -- NULL = never fetched from OpenF1 (seed/fake rounds)
  race_session_key  INTEGER,
  lock_at           INTEGER NOT NULL,         -- qualifying start
  quali_end         INTEGER NOT NULL,
  race_start        INTEGER NOT NULL,
  race_end          INTEGER NOT NULL,
  results_json      TEXT,                     -- RoundResults
  results_hash      TEXT,                     -- changes when results are amended
  results_checked_at INTEGER,
  scored_at         INTEGER
);
CREATE INDEX idx_rounds_season ON rounds(season, lock_at);

CREATE TABLE drivers (
  number     INTEGER PRIMARY KEY,
  acronym    TEXT NOT NULL,
  full_name  TEXT NOT NULL,
  team       TEXT NOT NULL,
  colour     TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE picks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id   TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id    INTEGER NOT NULL REFERENCES rounds(id),
  pole        INTEGER NOT NULL,
  p1          INTEGER NOT NULL,
  p2          INTEGER NOT NULL,
  p3          INTEGER NOT NULL,
  fastest_lap INTEGER NOT NULL,
  first_dnf   INTEGER NOT NULL,
  chaos       TEXT NOT NULL CHECK (chaos IN ('SAFETY_CAR','RED_FLAG','VSC','LAP1_INCIDENT','NO_SC')),
  updated_at  INTEGER NOT NULL,
  UNIQUE (league_id, user_id, round_id),
  CHECK (p1 <> p2 AND p1 <> p3 AND p2 <> p3)
);
CREATE INDEX idx_picks_round ON picks(round_id);

-- Per-category points. points NULL = pending. Rewritten in place on every scoring run.
CREATE TABLE pick_scores (
  pick_id  INTEGER NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  points   INTEGER,
  PRIMARY KEY (pick_id, category)
);

CREATE TABLE push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- One job per (round, kind). The primary key is the "send once" guard;
-- cursor lets the fan-out continue across cron ticks within the subrequest limit.
CREATE TABLE notification_jobs (
  round_id   INTEGER NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('LOCK_T60','LOCK_T10','RESULTS')),
  cursor     INTEGER NOT NULL DEFAULT 0,      -- last push_subscriptions.id processed
  done       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (round_id, kind)
);

-- OpenF1 response cache.
CREATE TABLE api_cache (
  url        TEXT PRIMARY KEY,
  body       TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- Rendered share cards, keyed by what they were rendered from.
CREATE TABLE card_cache (
  league_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  round_id   INTEGER NOT NULL,
  version    TEXT NOT NULL,
  png        BLOB NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (league_id, user_id, round_id)
);
