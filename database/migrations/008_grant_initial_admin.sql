-- Make the project owner the first admin.
--
-- Runs once, on the deploy that includes it. If this account has not
-- registered yet it changes nothing; promote it later with:
--   heroku run npm run make-admin -- emmanuel.ademuwagun@gmail.com
UPDATE users
SET is_admin = TRUE
WHERE email = 'emmanuel.ademuwagun@gmail.com';
