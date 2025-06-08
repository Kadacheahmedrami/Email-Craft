-- Clean up any existing auth data that might be causing conflicts
-- Run this if you're still having issues

-- Delete all existing sessions
DELETE FROM sessions;

-- Delete all existing accounts
DELETE FROM accounts;

-- Delete all existing users (optional - only if you want a fresh start)
-- DELETE FROM users;

-- Reset sequences if needed
-- ALTER SEQUENCE users_id_seq RESTART WITH 1;
-- ALTER SEQUENCE accounts_id_seq RESTART WITH 1;
-- ALTER SEQUENCE sessions_id_seq RESTART WITH 1;

-- Verify tables are clean
SELECT COUNT(*) as user_count FROM users;
SELECT COUNT(*) as account_count FROM accounts;
SELECT COUNT(*) as session_count FROM sessions;
