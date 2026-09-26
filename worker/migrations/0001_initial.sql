PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin')),
  salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS repair_records (
  id TEXT PRIMARY KEY NOT NULL,
  owner_email TEXT NOT NULL,
  device TEXT NOT NULL CHECK (length(device) BETWEEN 2 AND 120),
  issue TEXT NOT NULL CHECK (length(issue) BETWEEN 4 AND 2000),
  work TEXT NOT NULL CHECK (length(work) BETWEEN 4 AND 4000),
  outcome TEXT NOT NULL CHECK (outcome IN ('open', 'in_progress', 'completed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS repair_records_owner_created ON repair_records(owner_email, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY NOT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO feature_flags (key, label, description, enabled) VALUES
  ('device_check', 'Device checkup', 'USB identity and a technician preparation checklist.', 1),
  ('repair_records', 'Repair records', 'Private, searchable technician service notes.', 1),
  ('firmware_check', 'Firmware file check', 'Local SHA-256 calculation and trusted value comparison.', 1);
