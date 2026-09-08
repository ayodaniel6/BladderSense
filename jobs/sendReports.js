/*
 * Tracking report runner.
 *
 * Emails each active tracker a plain-figures report of their tracking
 * data over a window. Two periods are supported:
 *
 *     npm run report:weekly    -> last 7 days
 *     npm run report:monthly   -> last 30 days
 *
 * or directly:
 *
 *     node jobs/sendReports.js weekly
 *     node jobs/sendReports.js monthly
 *
 * Schedule weekly reports once a week (e.g. Monday morning) and monthly
 * reports once a month (e.g. the 1st). Only users who logged at least one
 * entry inside the window and have a verified email are included, so
 * people who never tracked are not emailed an empty report.
 *
 * The report contains recorded figures only — no commentary or
 * interpretation is generated.
 */

const pool = require("./../database/db");

const { sendReportEmail } = require("../services/emailService");

const { buildTrackingSummary } = require("../utils/trackingSummary");


const PERIODS = {
    weekly: 7,
    monthly: 30
};


// Pull every in-window entry for verified users in one query, then group
// by user. The INNER JOIN means only users with at least one entry in
// the window are returned.
const fetchEntriesByUser = async (periodDays) => {
    const result = await pool.query(
        `
        SELECT
            users.id AS user_id,
            users.email,
            users.first_name,
            users.preferred_name,
            tracking_entries.entry_date,
            tracking_entries.night_time_urination,
            tracking_entries.evening_fluids,
            tracking_entries.activity_level,
            tracking_entries.stress_level,
            tracking_entries.sleep_quality
        FROM users
        INNER JOIN tracking_entries
            ON tracking_entries.user_id = users.id
        WHERE users.email_verified = TRUE
          AND tracking_entries.entry_date
              >= (CURRENT_DATE - ($1::int - 1))
          AND tracking_entries.entry_date <= CURRENT_DATE
        ORDER BY users.id, tracking_entries.entry_date ASC
        `,
        [periodDays]
    );

    const byUser = new Map();

    for (const row of result.rows) {
        if (!byUser.has(row.user_id)) {
            byUser.set(row.user_id, {
                id: row.user_id,
                email: row.email,
                firstName: row.first_name,
                preferredName: row.preferred_name,
                entries: []
            });
        }

        byUser.get(row.user_id).entries.push({
            entry_date: row.entry_date,
            night_time_urination: row.night_time_urination,
            evening_fluids: row.evening_fluids,
            activity_level: row.activity_level,
            stress_level: row.stress_level,
            sleep_quality: row.sleep_quality
        });
    }

    return [...byUser.values()];
};


const runReports = async (period) => {
    try {
        const periodDays = PERIODS[period];

        console.log(
            `Starting ${period} report run (${periodDays} days)...`
        );

        const users = await fetchEntriesByUser(periodDays);

        console.log(
            `${users.length} user(s) with tracking data in the window.`
        );

        let sent = 0;
        let failed = 0;

        for (const user of users) {
            const name = user.preferredName || user.firstName;

            const summary = buildTrackingSummary(
                user.entries,
                periodDays,
                new Date()
            );

            try {

                await sendReportEmail(user.email, name, {
                    period,
                    summary
                });

                sent += 1;

            } catch (sendError) {

                failed += 1;

                console.error(
                    `Failed to send ${period} report to ` +
                    `${user.email}:`,
                    sendError
                );
            }
        }

        console.log(
            `${period} report run complete. ` +
            `Sent: ${sent}, Failed: ${failed}.`
        );

    } catch (error) {

        console.error(`${period} report run failed:`, error);

        process.exitCode = 1;

    } finally {

        await pool.end();
    }
};


const period = (process.argv[2] || "").toLowerCase();

if (!PERIODS[period]) {
    console.error(
        "Usage: node jobs/sendReports.js <weekly|monthly>"
    );

    process.exitCode = 1;

} else {

    runReports(period);
}
