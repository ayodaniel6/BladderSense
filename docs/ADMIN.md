# Admin Dashboard — Backend Handoff

An admin dashboard for BladderSense. It shows platform stats and lets an
admin browse, inspect and manage users.

- **Page:** `GET /admin` — static HTML/CSS/JS in `public/admin/`, served by
  this Express app (same origin as the API, so the existing session cookie
  just works; no CORS changes needed).
- **API:** `/api/admin/*` — every route requires a signed-in user **and**
  `users.is_admin = TRUE`.
- **Sign-in:** reuses the existing email + 6-digit code flow
  (`/api/auth/request-login` → `/api/auth/verify-login`). No new auth system.


## Setup / deploy checklist

1. **Run the migration** — `database/migrations/007_add_user_admin_flag.sql`
   adds `users.is_admin BOOLEAN NOT NULL DEFAULT FALSE`.
   Heroku runs it automatically in the `release` phase (`npm run migrate`).
2. **Promote the first admin** (the account must already be registered):
   ```bash
   npm run make-admin -- someone@example.com
   # Heroku:
   heroku run npm run make-admin -- someone@example.com
   # Revoke:
   npm run make-admin -- someone@example.com --revoke
   ```
   After that, admins can promote/demote others from the dashboard.
3. Open `https://<api-host>/admin` and sign in with that email.

No new environment variables or dependencies.


## ⚠️ Behaviour change: `/api/users` is now admin-only

`GET /api/users` and `POST /api/users` (`routes/userRoutes.js`) were
**unauthenticated**: anyone could list every user record (all columns) or
create users that skip email verification. They now require an admin
session (401 if signed out, 403 if not an admin).

If the frontend or any script relies on them, switch it to
`GET /api/admin/users` / the normal `/api/auth/register` flow.


## ⚠️ Security fix: login/verification codes were returned in production

`POST /api/auth/request-login` returned the 6-digit login code in its JSON
response (`loginToken`) in **every** environment. Anyone who knew a user's
email could sign in as them, admins included. `POST /api/auth/register`
did the same with `verificationToken`.

Both are now only included when `NODE_ENV !== "production"`, which matches
what `resend-verification` already did. In production the code arrives only
by email. If the frontend auto-filled the code from the response, it needs
to ask the user to type it instead.


## `isAdmin` in user responses

`POST /api/auth/verify-login` and `GET /api/profile` now include
`user.isAdmin`, so the frontend can show or hide admin navigation.
Frontend details: [`ADMIN_FRONTEND.md`](./ADMIN_FRONTEND.md).


## Files

| File | Purpose |
| --- | --- |
| `database/migrations/007_add_user_admin_flag.sql` | Adds `users.is_admin` |
| `middleware/authMiddleware.js` | Now also loads `is_admin` → `req.user.isAdmin` |
| `middleware/adminMiddleware.js` | `requireAdmin` — 403 unless `req.user.isAdmin` |
| `controllers/adminController.js` | Admin endpoint handlers |
| `routes/adminRoutes.js` | Mounts `/api/admin/*` behind `requireAuth` + `requireAdmin` |
| `routes/userRoutes.js` | `/api/users` locked to admins |
| `controllers/authController.js` | Codes returned in dev only; `isAdmin` in the login response |
| `controllers/profileController.js` | `isAdmin` in the profile response |
| `docs/ADMIN_FRONTEND.md` | Frontend integration guide |
| `scripts/makeAdmin.js` | `npm run make-admin` CLI |
| `server.js` | Mounts admin routes and serves `public/admin` at `/admin` |
| `public/admin/*` | The dashboard page (no build step, no framework) |


## API reference

All responses are JSON. Errors are `{ "error": "message" }`.

| Status | Meaning |
| --- | --- |
| `401` | Not signed in / session expired |
| `403` | Signed in but not an admin |
| `404` | User not found (including malformed IDs) |
| `400` | Validation error |

### `GET /api/admin/stats`

Platform totals plus a zero-filled 14-day activity series.

```json
{
  "stats": {
    "totalUsers": 28,
    "verifiedUsers": 22,
    "adminUsers": 1,
    "newUsers7d": 7,
    "newUsers30d": 28,
    "activeUsers7d": 27,      // distinct users with an entry in the last 7 days
    "activeUsers30d": 28,
    "totalEntries": 192,
    "entries7d": 69,
    "remindersEnabled": 9,    // rows in reminder_preferences with reminders on
    "activeSessions": 2       // unexpired sessions
  },
  "dailyActivity": [
    { "date": "2026-09-09T00:00:00.000Z", "signups": 1, "entries": 6 }
    // … 14 days, oldest first
  ]
}
```

### `GET /api/admin/users`

Paginated user list, newest first.

| Query | Default | Notes |
| --- | --- | --- |
| `page` | `1` | |
| `limit` | `20` | max `100` |
| `search` | — | case-insensitive match on email, first, last or preferred name |
| `status` | — | `verified`, `unverified` or `admin` |

```json
{
  "users": [
    {
      "id": "…",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "preferredName": null,
      "email": "ada@example.com",
      "emailVerified": true,
      "isAdmin": false,
      "createdAt": "…",
      "lastLoginAt": "…",
      "entryCount": 8,
      "lastEntryDate": "…"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 27, "totalPages": 2 }
}
```

### `GET /api/admin/users/:id`

Everything about one user.

```json
{
  "user": { /* same fields as the list */, "activeSessions": 1 },
  "reminders": {
    "remindersEnabled": true,
    "frequency": "weekly",
    "lastRemindedAt": null
  },
  "recentEntries": [ /* up to 30 entries, newest first, same shape as GET /api/tracking */ ],
  "summary": { /* 30-day summary, same shape as GET /api/tracking/summary */ }
}
```

If the user never saved reminder settings, `reminders` shows the table
defaults (`true` / `"daily"`).

### `PATCH /api/admin/users/:id`

Body (any subset):

```json
{ "isAdmin": true, "emailVerified": true }
```

- Both must be booleans.
- An admin **cannot remove their own** admin access (prevents lock-out).

Returns `{ "message": "...", "user": { … } }`.

### `POST /api/admin/users/:id/logout`

Deletes all of the user's sessions (signs them out on every device).

```json
{ "message": "User has been signed out of all devices", "sessionsRevoked": 1 }
```

### `DELETE /api/admin/users/:id`

Permanently deletes the user and all their data (tracking entries,
reminder preferences, auth tokens, sessions), in one transaction —
the same purge as `DELETE /api/profile`.

- An admin **cannot delete their own** account here (use `DELETE /api/profile`).
- The dashboard makes the admin type the user's email to confirm.


## Security notes

- Every admin route goes through `requireAuth` then `requireAdmin`; the
  check reads `is_admin` fresh from the DB on each request, so demoting
  someone takes effect immediately.
- All SQL is parameterised. Dynamic parts (`WHERE`/`SET` clauses) are
  built only from fixed strings; user input is always a bound parameter.
- IDs are compared as `id::text = $1`, so malformed IDs return 404 rather
  than a Postgres UUID cast error (500).
- The page is served under the existing Helmet CSP: no inline scripts,
  and all user-supplied text (names, notes) is rendered with
  `textContent`, never `innerHTML`.
- `/admin` has `<meta name="robots" content="noindex">`. The static files
  themselves are public (they contain no data); all data is behind the API.


## Suggested follow-ups (not in this change)

- An audit log table recording which admin deleted/promoted whom.
- Rate limiting on `/api/auth/request-login` (applies to the whole app).
- CSV export of the user list, if the team needs it for reporting.
