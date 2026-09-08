-- Rename auth_tokens.token to token_hash.
--
-- Written to be idempotent so it is safe to run against a database where
-- the rename has already been applied (e.g. a schema created outside the
-- migration runner). The rename only happens when the old column still
-- exists and the new one does not; otherwise this is a no-op.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'auth_tokens'
          AND column_name = 'token'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'auth_tokens'
          AND column_name = 'token_hash'
    ) THEN
        ALTER TABLE auth_tokens
            RENAME COLUMN token TO token_hash;
    END IF;
END $$;
