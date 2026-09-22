const pool = require("../database/db");

const {
    buildTrackingSummary
} = require("../utils/trackingSummary");


const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const SUMMARY_DAYS = 30;
const RECENT_ENTRIES_LIMIT = 30;


const formatUser = (user) => ({
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    preferredName: user.preferred_name,
    email: user.email,
    emailVerified: user.email_verified,
    isAdmin: user.is_admin,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
    entryCount: user.entry_count !== undefined
        ? Number(user.entry_count)
        : undefined,
    lastEntryDate: user.last_entry_date
});


const formatEntry = (entry) => ({
    id: entry.id,
    entryDate: entry.entry_date,
    nightTimeUrination: entry.night_time_urination,
    eveningFluids: entry.evening_fluids,
    activityLevel: entry.activity_level,
    stressLevel: entry.stress_level,
    sleepQuality: entry.sleep_quality,
    notes: entry.notes,
    updatedAt: entry.updated_at
});


// ============================================================
// GET /api/admin/stats
// ============================================================

const getStats = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                (SELECT COUNT(*) FROM users)
                    AS total_users,
                (SELECT COUNT(*) FROM users WHERE email_verified)
                    AS verified_users,
                (SELECT COUNT(*) FROM users WHERE is_admin)
                    AS admin_users,
                (SELECT COUNT(*) FROM users
                    WHERE created_at >= NOW() - INTERVAL '7 days')
                    AS new_users_7d,
                (SELECT COUNT(*) FROM users
                    WHERE created_at >= NOW() - INTERVAL '30 days')
                    AS new_users_30d,
                (SELECT COUNT(DISTINCT user_id) FROM tracking_entries
                    WHERE entry_date >= CURRENT_DATE - 6)
                    AS active_users_7d,
                (SELECT COUNT(DISTINCT user_id) FROM tracking_entries
                    WHERE entry_date >= CURRENT_DATE - 29)
                    AS active_users_30d,
                (SELECT COUNT(*) FROM tracking_entries)
                    AS total_entries,
                (SELECT COUNT(*) FROM tracking_entries
                    WHERE entry_date >= CURRENT_DATE - 6)
                    AS entries_7d,
                (SELECT COUNT(*) FROM reminder_preferences
                    WHERE reminders_enabled)
                    AS reminders_enabled,
                (SELECT COUNT(*) FROM sessions
                    WHERE expires_at > NOW())
                    AS active_sessions
            `
        );

        // Daily sign-ups and entries for the last 14 days, zero-filled.
        const activityResult = await pool.query(
            `
            SELECT
                day::date AS date,
                (SELECT COUNT(*) FROM users
                    WHERE created_at::date = day::date) AS signups,
                (SELECT COUNT(*) FROM tracking_entries
                    WHERE entry_date = day::date) AS entries
            FROM generate_series(
                CURRENT_DATE - 13,
                CURRENT_DATE,
                INTERVAL '1 day'
            ) AS day
            ORDER BY day
            `
        );

        const row = result.rows[0];

        const stats = {};

        for (const [key, value] of Object.entries(row)) {
            // snake_case -> camelCase, COUNT() comes back as a string
            const camelKey = key.replace(
                /_([a-z0-9])/g,
                (_, char) => char.toUpperCase()
            );

            stats[camelKey] = Number(value);
        }

        res.json({
            stats,
            dailyActivity: activityResult.rows.map((day) => ({
                date: day.date,
                signups: Number(day.signups),
                entries: Number(day.entries)
            }))
        });

    } catch (error) {
        console.error("Admin stats error:", error);

        res.status(500).json({
            error: "Failed to load admin stats"
        });
    }
};


// ============================================================
// GET /api/admin/users?search=&page=&limit=&status=
// ============================================================

const listUsers = async (req, res) => {
    try {
        let page = Number.parseInt(req.query.page, 10);
        let limit = Number.parseInt(req.query.limit, 10);

        if (!Number.isFinite(page) || page < 1) {
            page = 1;
        }

        if (!Number.isFinite(limit) || limit < 1) {
            limit = DEFAULT_PAGE_SIZE;
        }

        limit = Math.min(limit, MAX_PAGE_SIZE);

        const search = typeof req.query.search === "string"
            ? req.query.search.trim()
            : "";

        const conditions = [];
        const params = [];

        if (search) {
            params.push(`%${search}%`);

            conditions.push(`(
                users.email ILIKE $${params.length}
                OR users.first_name ILIKE $${params.length}
                OR users.last_name ILIKE $${params.length}
                OR users.preferred_name ILIKE $${params.length}
            )`);
        }

        switch (req.query.status) {
            case "verified":
                conditions.push("users.email_verified = TRUE");
                break;
            case "unverified":
                conditions.push("users.email_verified = FALSE");
                break;
            case "admin":
                conditions.push("users.is_admin = TRUE");
                break;
            default:
                break;
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const countResult = await pool.query(
            `SELECT COUNT(*) AS total FROM users ${whereClause}`,
            params
        );

        const total = Number(countResult.rows[0].total);

        const usersResult = await pool.query(
            `
            SELECT
                users.id,
                users.first_name,
                users.last_name,
                users.preferred_name,
                users.email,
                users.email_verified,
                users.is_admin,
                users.created_at,
                users.last_login_at,
                COUNT(tracking_entries.id) AS entry_count,
                MAX(tracking_entries.entry_date) AS last_entry_date
            FROM users
            LEFT JOIN tracking_entries
                ON tracking_entries.user_id = users.id
            ${whereClause}
            GROUP BY users.id
            ORDER BY users.created_at DESC
            LIMIT $${params.length + 1}
            OFFSET $${params.length + 2}
            `,
            [...params, limit, (page - 1) * limit]
        );

        res.json({
            users: usersResult.rows.map(formatUser),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit))
            }
        });

    } catch (error) {
        console.error("Admin list users error:", error);

        res.status(500).json({
            error: "Failed to load users"
        });
    }
};


// ============================================================
// GET /api/admin/users/:id
// ============================================================

const getUser = async (req, res) => {
    try {
        const { id } = req.params;

        const userResult = await pool.query(
            `
            SELECT
                users.id,
                users.first_name,
                users.last_name,
                users.preferred_name,
                users.email,
                users.email_verified,
                users.is_admin,
                users.created_at,
                users.last_login_at,
                (SELECT COUNT(*) FROM tracking_entries
                    WHERE user_id = users.id) AS entry_count,
                (SELECT MAX(entry_date) FROM tracking_entries
                    WHERE user_id = users.id) AS last_entry_date,
                (SELECT COUNT(*) FROM sessions
                    WHERE user_id = users.id
                      AND expires_at > NOW()) AS active_sessions
            FROM users
            WHERE users.id::text = $1
            `,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        const user = userResult.rows[0];

        const [remindersResult, entriesResult, summaryResult] =
            await Promise.all([
                pool.query(
                    `
                    SELECT
                        reminders_enabled,
                        frequency,
                        last_reminded_at
                    FROM reminder_preferences
                    WHERE user_id = $1
                    `,
                    [user.id]
                ),
                pool.query(
                    `
                    SELECT
                        id,
                        entry_date,
                        night_time_urination,
                        evening_fluids,
                        activity_level,
                        stress_level,
                        sleep_quality,
                        notes,
                        updated_at
                    FROM tracking_entries
                    WHERE user_id = $1
                    ORDER BY entry_date DESC
                    LIMIT $2
                    `,
                    [user.id, RECENT_ENTRIES_LIMIT]
                ),
                pool.query(
                    `
                    SELECT
                        id,
                        entry_date,
                        night_time_urination,
                        evening_fluids,
                        activity_level,
                        stress_level,
                        sleep_quality,
                        notes,
                        updated_at
                    FROM tracking_entries
                    WHERE user_id = $1
                      AND entry_date >= (CURRENT_DATE - ($2::int - 1))
                      AND entry_date <= CURRENT_DATE
                    ORDER BY entry_date ASC
                    `,
                    [user.id, SUMMARY_DAYS]
                )
            ]);

        // Users who never opened reminder settings get the table defaults.
        const reminders = remindersResult.rows[0];

        res.json({
            user: {
                ...formatUser(user),
                activeSessions: Number(user.active_sessions)
            },
            reminders: reminders
                ? {
                    remindersEnabled: reminders.reminders_enabled,
                    frequency: reminders.frequency,
                    lastRemindedAt: reminders.last_reminded_at
                }
                : {
                    remindersEnabled: true,
                    frequency: "daily",
                    lastRemindedAt: null
                },
            recentEntries: entriesResult.rows.map(formatEntry),
            summary: buildTrackingSummary(
                summaryResult.rows,
                SUMMARY_DAYS,
                new Date()
            )
        });

    } catch (error) {
        console.error("Admin get user error:", error);

        res.status(500).json({
            error: "Failed to load user"
        });
    }
};


// ============================================================
// PATCH /api/admin/users/:id
// Body: { isAdmin?: boolean, emailVerified?: boolean }
// ============================================================

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { isAdmin, emailVerified } = req.body || {};

        const updates = [];
        const params = [];

        if (isAdmin !== undefined) {
            if (typeof isAdmin !== "boolean") {
                return res.status(400).json({
                    error: "isAdmin must be true or false"
                });
            }

            // Stop an admin from locking themselves out.
            if (
                id.toLowerCase() === req.user.id &&
                isAdmin === false
            ) {
                return res.status(400).json({
                    error: "You cannot remove your own admin access"
                });
            }

            params.push(isAdmin);
            updates.push(`is_admin = $${params.length}`);
        }

        if (emailVerified !== undefined) {
            if (typeof emailVerified !== "boolean") {
                return res.status(400).json({
                    error: "emailVerified must be true or false"
                });
            }

            params.push(emailVerified);
            updates.push(`email_verified = $${params.length}`);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: "No changes were provided"
            });
        }

        params.push(id);

        const result = await pool.query(
            `
            UPDATE users
            SET ${updates.join(", ")}
            WHERE id::text = $${params.length}
            RETURNING
                id,
                first_name,
                last_name,
                preferred_name,
                email,
                email_verified,
                is_admin,
                created_at,
                last_login_at
            `,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        res.json({
            message: "User updated successfully",
            user: formatUser(result.rows[0])
        });

    } catch (error) {
        console.error("Admin update user error:", error);

        res.status(500).json({
            error: "Failed to update user"
        });
    }
};


// ============================================================
// POST /api/admin/users/:id/logout
// Signs the user out everywhere by deleting all their sessions.
// ============================================================

const revokeSessions = async (req, res) => {
    try {
        const { id } = req.params;

        const userResult = await pool.query(
            "SELECT id FROM users WHERE id::text = $1",
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        const result = await pool.query(
            "DELETE FROM sessions WHERE user_id = $1",
            [userResult.rows[0].id]
        );

        res.json({
            message: "User has been signed out of all devices",
            sessionsRevoked: result.rowCount
        });

    } catch (error) {
        console.error("Admin revoke sessions error:", error);

        res.status(500).json({
            error: "Failed to sign user out"
        });
    }
};


// ============================================================
// DELETE /api/admin/users/:id
// ============================================================

const deleteUser = async (req, res) => {
    const { id } = req.params;

    // Admins remove their own account through DELETE /api/profile.
    if (id.toLowerCase() === req.user.id) {
        return res.status(400).json({
            error: "You cannot delete your own account from the admin panel"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const userResult = await client.query(
            "SELECT id, email FROM users WHERE id::text = $1",
            [id]
        );

        if (userResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "User not found"
            });
        }

        const userId = userResult.rows[0].id;

        // Same purge order as DELETE /api/profile.
        await client.query(
            "DELETE FROM tracking_entries WHERE user_id = $1",
            [userId]
        );

        await client.query(
            "DELETE FROM reminder_preferences WHERE user_id = $1",
            [userId]
        );

        await client.query(
            "DELETE FROM auth_tokens WHERE user_id = $1",
            [userId]
        );

        await client.query(
            "DELETE FROM sessions WHERE user_id = $1",
            [userId]
        );

        await client.query(
            "DELETE FROM users WHERE id = $1",
            [userId]
        );

        await client.query("COMMIT");

        res.json({
            message: `User ${userResult.rows[0].email} has been deleted`
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "Admin delete user rollback error:",
                rollbackError
            );
        }

        console.error("Admin delete user error:", error);

        res.status(500).json({
            error: "Failed to delete user"
        });

    } finally {
        client.release();
    }
};


module.exports = {
    getStats,
    listUsers,
    getUser,
    updateUser,
    revokeSessions,
    deleteUser
};
