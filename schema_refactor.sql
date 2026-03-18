-- Migration: Multi-tenant (Family-scoped) schema refactor

DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS families;

-- 1. families: ID and Name (Unique)
CREATE TABLE families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. users: Username is unique ONLY within the same family
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  family_id INTEGER REFERENCES families(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(username, family_id)
);

-- 3. items: Associated with family
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  unit TEXT DEFAULT '個',
  bought INTEGER DEFAULT 0,
  category TEXT DEFAULT 'other',
  image_url TEXT,
  family_id INTEGER REFERENCES families(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize Default Family
INSERT INTO families (id, name) VALUES (1, 'Default Family');
