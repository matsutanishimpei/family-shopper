-- Migration: Support Multiple Families (Fixed for SQLite/D1)

-- 1. familiesテーブルの作成
CREATE TABLE IF NOT EXISTS families (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. デフォルトの家族を作成
INSERT INTO families (id, name) VALUES (1, 'デフォルト家族');

-- 3. usersテーブルにfamily_idを追加（REFERENCESとDEFAULTの同時指定エラーを回避）
-- まずカラムを追加（NULL許容）
ALTER TABLE users ADD COLUMN family_id INTEGER;
-- 既存データをデフォルト家族に紐付け
UPDATE users SET family_id = 1;

-- 4. itemsテーブルにfamily_idを追加
ALTER TABLE items ADD COLUMN family_id INTEGER;
UPDATE items SET family_id = 1;
