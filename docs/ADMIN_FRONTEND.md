# Admin — Frontend Integration Guide

Everything the frontend needs to use the BladderSense admin features.
(Backend setup lives in [`ADMIN.md`](./ADMIN.md).)


## Two ways to use it

**Option A: use the ready-made page (no frontend work).**
The backend already serves a complete admin dashboard at:

```
https://<api-host>/admin
```

Just link to it from the main app, e.g. an "Admin" item in the menu that
only shows when `user.isAdmin` is `true` (see below).

**Option B: build admin screens inside the main frontend.**
Use the API below. The ready-made page in `public/admin/` is a working
reference implementation (plain JS in `admin.js`).


## 1. Knowing whether someone is an admin

`isAdmin` is now included in both places the frontend already reads the user:

```jsonc
// POST /api/auth/verify-login  → 200
{ "message": "Login successful",
  "user": { "id": "…", "firstName": "Ada", "lastName": "Lovelace",
            "preferredName": null, "email": "ada@example.com",
            "isAdmin": true } }

// GET /api/profile  → 200
{ "user": { …, "emailVerified": true, "createdAt": "…",
            "lastLoginAt": "…", "isAdmin": true } }
```

Show admin navigation only when `user.isAdmin === true`. That only hides
the UI; the server enforces access on every admin request regardless.


## 2. Making requests

Auth is the existing httpOnly cookie (`bladdersense_session`), so there
are **no tokens to store or headers to add**. Every request must send
cookies:

```js
const API = import.meta.env.VITE_API_URL; // e.g. https://api.bladdersense.com

async function adminApi(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}/api/admin${path}`, {
    method,
    credentials: "include",                      // ← required
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
```

With axios: `axios.create({ baseURL: API, withCredentials: true })`.

CORS already allows the app's `FRONTEND_URL` with credentials for
`GET, POST, PUT, PATCH, DELETE`.

### Errors

Every error is `{ "error": "Human-readable message" }`. Show the message
as-is.

| Status | Meaning | What to do |
| --- | --- | --- |
| `401` | Not signed in / session expired | Send to login |
| `403` | Signed in, not an admin | Show "no access" / hide admin area |
| `404` | User not found (e.g. already deleted) | Toast + go back to list |
| `400` | Validation error (e.g. trying to demote yourself) | Show the message |
| `500` | Server error | Show the message, allow retry |


## 3. Endpoints

### Dashboard stats: `GET /api/admin/stats`

```ts
type StatsResponse = {
  stats: {
    totalUsers: number;
    verifiedUsers: number;
    adminUsers: number;
    newUsers7d: number;
    newUsers30d: number;
    activeUsers7d: number;    // users who logged an entry in the last 7 days
    activeUsers30d: number;
    totalEntries: number;
    entries7d: number;
    remindersEnabled: number;
    activeSessions: number;
  };
  dailyActivity: {            // always 14 items, oldest first
    date: string;             // "2026-09-09T00:00:00.000Z" (use .slice(0, 10))
    signups: number;
    entries: number;
  }[];
};
```

### User list: `GET /api/admin/users`

Query params (all optional):

| Param | Default | Notes |
| --- | --- | --- |
| `page` | `1` | 1-based |
| `limit` | `20` | max `100` |
| `search` | | matches email, first/last/preferred name (case-insensitive). Debounce ~300 ms. |
| `status` | | `verified` \| `unverified` \| `admin` |

```ts
type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;          // ISO timestamp
  lastLoginAt: string | null; // null = never signed in
  entryCount: number;
  lastEntryDate: string | null;
};

type UserListResponse = {
  users: AdminUser[];         // newest sign-ups first
  pagination: { page: number; limit: number; total: number; totalPages: number };
};
```

Example: `adminApi("/users?" + new URLSearchParams({ search: "ada", status: "verified", page: 1 }))`

### User detail: `GET /api/admin/users/:id`

```ts
type TrackingEntry = {
  id: string;
  entryDate: string;          // use .slice(0, 10) for the calendar day
  nightTimeUrination: "0" | "1" | "2" | "3+";
  eveningFluids: "None" | "Small" | "Moderate" | "Large";
  activityLevel: "None" | "Light" | "Moderate" | "High";
  stressLevel: "1" | "2" | "3" | "4" | "5";
  sleepQuality: "Poor" | "Fair" | "Good";
  notes: string | null;       // user-written text, render as plain text
  updatedAt: string;
};

type UserDetailResponse = {
  user: AdminUser & { activeSessions: number };
  reminders: {
    remindersEnabled: boolean;
    frequency: "daily" | "weekly";
    lastRemindedAt: string | null;
  };
  recentEntries: TrackingEntry[];   // up to 30, newest first
  summary: TrackingSummary;         // identical to GET /api/tracking/summary's `summary`
};
```

Most useful `summary` fields for an admin view:

| Field | Example |
| --- | --- |
| `summary.adherence.daysTracked` / `.expectedDays` / `.percent` | `7 / 30 / 23` |
| `summary.nightTimeUrination.averagePerNight` | `1.14` (or `null`) |
| `summary.nightTimeUrination.trend.direction` | `"improving" \| "worsening" \| "stable" \| "insufficient-data"` |
| `summary.sleepQuality.average` | `2` (1 = Poor … 3 = Good) |
| `summary.sleepQuality.trend.direction` | same values as above |

### Update a user: `PATCH /api/admin/users/:id`

```ts
// body: send only what changes
{ isAdmin?: boolean; emailVerified?: boolean }

// 200
{ message: string; user: AdminUser }
```

- Hide "Remove admin" on the signed-in admin's own row; the server rejects it anyway (`400`).
- Ask for confirmation before granting or removing admin.

### Sign a user out everywhere: `POST /api/admin/users/:id/logout`

```ts
// 200
{ message: string; sessionsRevoked: number }
```

### Delete a user: `DELETE /api/admin/users/:id`

```ts
// 200
{ message: string }
```

- **Permanent**: removes the account and all tracking data.
- Require a strong confirmation (the ready-made page makes the admin
  type the user's email).
- Hide it for the signed-in admin's own account (server returns `400`).
- After success, close the detail view and refresh the list + stats.


## 4. Gotchas

- **Always `credentials: "include"`.** Without it every call is `401`.
- **Dates:** `entryDate`, `lastEntryDate` and `dailyActivity[].date` are
  calendar days sent as UTC-midnight timestamps. Use `.slice(0, 10)`
  rather than `new Date(...)`, or users west of UTC will see the
  previous day.
- **Render user text as text.** Names and `notes` are user-supplied. In
  React this is automatic; never use `dangerouslySetInnerHTML` /
  `innerHTML` / `v-html` for them.
- **`loginToken` / `verificationToken` are no longer returned in
  production.** `/api/auth/request-login` and `/api/auth/register` used to
  include the 6-digit code in the JSON response. That let anyone sign in
  as any user, so the code now only arrives by email (it's still in the
  response in local development). If any screen auto-filled the code from
  the response, it must ask the user to type it from their email.
- **`/api/users` is now admin-only.** If anything in the frontend called
  `GET /api/users` or `POST /api/users`, switch to `/api/admin/users` or
  `/api/auth/register`.


## 5. Suggested screens (Option B)

1. **Overview**: stat cards from `stats` + a 14-day bar chart from `dailyActivity`.
2. **Users**: table (name, email, verified/admin badges, entries, last
   entry, joined) with search, status filter and pagination.
3. **User detail** (drawer or page): account info, reminder settings,
   30-day summary cards, recent entries table, and the actions above.

See `/admin` on the backend for a working version of exactly this layout.
