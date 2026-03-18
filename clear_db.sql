-- Warning: This script will delete all data from the database.
DELETE FROM items;
DELETE FROM users;
DELETE FROM families;
DELETE FROM sqlite_sequence WHERE name IN ('items', 'users', 'families');

-- Fallback for system admin: reinsert default family
INSERT INTO families (id, name) VALUES (1, 'Default Family');
