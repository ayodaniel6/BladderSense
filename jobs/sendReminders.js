/*
 * Tracking reminder runner.
 *
 * Finds active trackers who are due a nudge and emails them, then
 * records the send so nobody is reminded more than once per cadence.
 *
 * This is designed to be run as a scheduled one-shot (e.g. a cron job or
 * a platform scheduler) rather than a long-lived process:
 *
 *     npm run reminders
 *
 * Run it once a day. Users on the "daily" cadence are reminded on any
 * day they have not logged an entry; users on the "weekly" cadence are
 * reminded only at the beginning of the week (Monday) when they have not
 * logged an entry in the past week.
 *
 * "Active tracker" means the user has logged at least one entry in the
 * last 30 days, so people who have not started or have long finished are
 * not emailed.
 */

const pool = require("./../database/db");

const { sendReminderEmail } = require("../services/emailService");


const findUsersDueForReminder = async () => {
    const result = await pool.query(
        `
        SELECT
            users.id,
            users.email,
            users.first_name,
            users.preferred_name,
            reminder_preferences.frequency
        FROM reminder_preferences
        INNER JOIN users
            ON users.id = reminder_preferences.user_id
        WHERE reminder_preferences.reminders_enabled = TRUE
          AND users.email_verified = TRUE
          -- Only nudge people who are actively in a tracking period.
          AND EXISTS (
              SELECT 1
              FROM tracking_entries
              WHERE tracking_entries.user_id = users.id
                AND tracking_entries.entry_date
                    >= CURRENT_DATE - 29
          )
          AND (
              (
                  reminder_preferences.frequency = 'daily'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM tracking_entries
                      WHERE tracking_entries.user_id = users.id
                        AND tracking_entries.entry_date = CURRENT_DATE
                  )
                  AND (
                      reminder_preferences.last_reminded_at IS NULL
                      OR reminder_preferences.last_reminded_at
                         < NOW() - INTERVAL '20 hours'
                  )
              )
              OR
              (
                  reminder_preferences.frequency = 'weekly'
                  -- Beginning of the week only (Monday).
                  AND EXTRACT(DOW FROM CURRENT_DATE) = 1
                  AND NOT EXISTS (
                      SELECT 1
                      FROM tracking_entries
                      WHERE tracking_entries.user_id = users.id
                        AND tracking_entries.entry_date
                            >= CURRENT_DATE - 6
                  )
                  AND (
                      reminder_preferences.last_reminded_at IS NULL
                      OR reminder_preferences.last_reminded_at
                         < NOW() - INTERVAL '6 days'
                  )
              )
          )
        `
    );

    return result.rows;
};


// Core reminder run. Does NOT close the database pool, so it can be
// called repeatedly by the in-process scheduler while the server keeps
// running. The standalone CLI entry point below closes the pool itself.
const runReminders = async () => {
    console.log("Starting tracking reminder run...");

    const users = await findUsersDueForReminder();

    console.log(
        `${users.length} user(s) due for a reminder.`
    );

    let sent = 0;
    let failed = 0;

    for (const user of users) {
        const name = user.preferred_name || user.first_name;

        try {

            await sendReminderEmail(user.email, name, {
                frequency: user.frequency
            });

            // Only record the send once the email succeeds so a
            // transient failure does not silently skip a user until
            // the next cadence.
            await pool.query(
                `
                UPDATE reminder_preferences
                SET last_reminded_at = NOW()
                WHERE user_id = $1
                `,
                [user.id]
            );

            sent += 1;

        } catch (sendError) {

            failed += 1;

            console.error(
                `Failed to send reminder to ${user.email}:`,
                sendError
            );
        }
    }

    console.log(
        `Reminder run complete. Sent: ${sent}, Failed: ${failed}.`
    );

    return { sent, failed };
};


module.exports = { runReminders, findUsersDueForReminder };


// Allow running by hand: `node jobs/sendReminders.js`.
if (require.main === module) {
    runReminders()
        .catch((error) => {
            console.error("Reminder run failed:", error);
            process.exitCode = 1;
        })
        .finally(() => pool.end());
}
