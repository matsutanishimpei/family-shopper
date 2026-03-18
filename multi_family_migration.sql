-- Migration: Support Multiple Families

-- 1. familiesテーブルの作成
CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. デフォルトの家族を作成
INSERT INTO families (id, name) VALUES (1, 'デフォルト家族');

-- 3. usersテーブルにfamily_idを追加（D1ではALTER TABLEでNOT NULL DEFAULTを追加するのが安全）
ALTER TABLE users ADD COLUMN family_id INTEGER REFERENCES families(id) DEFAULT 1;

-- 4. itemsテーブルにfamily_idを追加
ALTER TABLE items ADD COLUMN family_id INTEGER REFERENCES families(id) DEFAULT 1;
