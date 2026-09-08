const pool = require("../database/db");


const ALLOWED_FREQUENCIES = ["daily", "weekly"];


const formatPreferences = (row) => ({
    remindersEnabled: row.reminders_enabled,
    frequency: row.frequency,
    lastRemindedAt: row.last_reminded_at,
    updatedAt: row.updated_at
});


// Return the caller's reminder preferences, creating a default row the
// first time they are requested so the frontend always has something to
// display.
const getReminderPreferences = async (req, res) => {
    try {
        const result = await pool.query(
            `
            INSERT INTO reminder_preferences (user_id)
            VALUES ($1)
            ON CONFLICT (user_id) DO UPDATE
                SET user_id = reminder_preferences.user_id
            RETURNING
                reminders_enabled,
                frequency,
                last_reminded_at,
                updated_at
            `,
            [req.user.id]
        );

        res.json({
            preferences: formatPreferences(result.rows[0])
        });

    } catch (error) {

        console.error(
            "Get reminder preferences error:",
            error
        );

        res.status(500).json({
            error: "Failed to retrieve reminder preferences"
        });
    }
};


const updateReminderPreferences = async (req, res) => {
    try {
        const { remindersEnabled, frequency } = req.body || {};

        const errors = {};

        if (
            remindersEnabled !== undefined &&
            typeof remindersEnabled !== "boolean"
        ) {
            errors.remindersEnabled =
                "Reminders enabled must be true or false";
        }

        if (
            frequency !== undefined &&
            !ALLOWED_FREQUENCIES.includes(frequency)
        ) {
            errors.frequency =
                "Frequency must be 'daily' or 'weekly'";
        }

        if (
            remindersEnabled === undefined &&
            frequency === undefined
        ) {
            return res.status(400).json({
                error: "No reminder changes were provided"
            });
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                error: "Validation failed",
                fields: errors
            });
        }


        /*
         * Upsert so a user who has never loaded their preferences can
         * still update them. COALESCE keeps any field the caller left
         * out at its current (or default) value.
         */
        const result = await pool.query(
            `
            INSERT INTO reminder_preferences (
                user_id,
                reminders_enabled,
                frequency,
                updated_at
            )
            VALUES (
                $1,
                COALESCE($2, TRUE),
                COALESCE($3, 'daily'),
                NOW()
            )
            ON CONFLICT (user_id) DO UPDATE
                SET
                    reminders_enabled = COALESCE(
                        $2,
                        reminder_preferences.reminders_enabled
                    ),
                    frequency = COALESCE(
                        $3,
                        reminder_preferences.frequency
                    ),
                    updated_at = NOW()
            RETURNING
                reminders_enabled,
                frequency,
                last_reminded_at,
                updated_at
            `,
            [
                req.user.id,
                remindersEnabled === undefined
                    ? null
                    : remindersEnabled,
                frequency === undefined ? null : frequency
            ]
        );

        res.json({
            message: "Reminder preferences updated successfully",
            preferences: formatPreferences(result.rows[0])
        });

    } catch (error) {

        console.error(
            "Update reminder preferences error:",
            error
        );

        res.status(500).json({
            error: "Failed to update reminder preferences"
        });
    }
};


module.exports = {
    getReminderPreferences,
    updateReminderPreferences
};
