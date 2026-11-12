-- АРХИВ 9.1 · Cloudflare D1 (SQLite).
-- Deploy: npx wrangler d1 execute archive-users --remote --file cloudflare/schema.sql
-- This database is private: the Worker D1 binding is the only access path.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS archive_users (
  telegram_id INTEGER PRIMARY KEY CHECK (telegram_id > 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS archive_story_state (
  telegram_id INTEGER NOT NULL REFERENCES archive_users(telegram_id) ON DELETE CASCADE,
  story_id INTEGER NOT NULL CHECK (story_id BETWEEN 1 AND 1000000),
  rating INTEGER NOT NULL DEFAULT 0 CHECK (rating IN (-1,0,1)),
  bookmarked INTEGER NOT NULL DEFAULT 0 CHECK (bookmarked IN (0,1)),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  last_read_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (telegram_id, story_id)
);

CREATE INDEX IF NOT EXISTS archive_user_bookmarks ON archive_story_state
  (telegram_id, updated_at DESC) WHERE bookmarked = 1;

CREATE INDEX IF NOT EXISTS archive_user_ratings ON archive_story_state
  (telegram_id, rating) WHERE rating <> 0;
