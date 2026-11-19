CREATE TABLE IF NOT EXISTS user_states (
  user_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tracked_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  identifier TEXT NOT NULL,
  display_name TEXT,
  last_fetched_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(owner_user_id, platform, identifier)
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  source_id INTEGER NOT NULL,
  external_id TEXT NOT NULL,
  published_at TEXT NOT NULL,
  format_type TEXT NOT NULL,
  caption TEXT,
  url TEXT,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  forwards INTEGER,
  topic_style TEXT,
  is_promotional INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT,
  UNIQUE(platform, source_id, external_id),
  FOREIGN KEY (source_id) REFERENCES tracked_sources(id)
);

CREATE TABLE IF NOT EXISTS monitored_brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_scan_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  identifier TEXT NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES monitored_brands(id)
);

CREATE TABLE IF NOT EXISTS ad_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL,
  source_platform TEXT NOT NULL,
  source_identifier TEXT NOT NULL,
  post_external_id TEXT,
  sample_text TEXT,
  detected_at TEXT NOT NULL,
  published_at TEXT,
  views INTEGER,
  notified INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT,
  FOREIGN KEY (brand_id) REFERENCES monitored_brands(id)
);