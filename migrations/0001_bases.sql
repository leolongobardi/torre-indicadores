CREATE TABLE IF NOT EXISTS catalogue (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  revision INTEGER NOT NULL,
  stamp TEXT NOT NULL
);
INSERT OR IGNORE INTO catalogue VALUES (1, 0, '');

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('fuel', 'cycle')),
  name TEXT NOT NULL,
  date_start TEXT NOT NULL,
  date_end TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  skipped INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS source_chunks (
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (source_id, seq)
);
