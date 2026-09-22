-- Give users an admin flag so the admin dashboard (/admin) and the
-- /api/admin endpoints can be restricted to trusted accounts.
--
-- Everyone defaults to a normal user. Promote an account with:
--   npm run make-admin -- someone@example.com
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
