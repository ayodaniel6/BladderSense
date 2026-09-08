/*
 * In-process scheduler.
 *
 * Runs the reminder and report jobs automatically on a fixed timetable
 * while the server is running, so nothing has to be triggered by hand.
 * It is started from server.js on boot.
 *
 * Default schedule (all times in SCHEDULER_TIMEZONE, default UTC):
 *   - Reminders:      every day at 08:00
 *   - Weekly report:  every Monday at 08:00
 *   - Monthly report: the 1st of each month at 08:00
 *
 * Notes / caveats:
 *   - This relies on the server process being alive at the scheduled
 *     time. On hosting that sleeps idle processes, use an always-on
 *     instance (or the platform's native scheduler running the npm
 *     scripts instead).
 *   - If more than one server instance runs, each would fire the jobs,
 *     so emails could be duplicated. Run the scheduler on a single
 *     instance, or set SCHEDULER_ENABLED=false on the others.
 */

const cron = require("node-cron");

const { runReminders } = require("./jobs/sendReminders");
const { runReports } = require("./jobs/sendReports");


// Times are interpreted in this timezone. Set SCHEDULER_TIMEZONE (an IANA
// name such as "Africa/Lagos") to match your users; defaults to UTC.
const TIMEZONE = process.env.SCHEDULER_TIMEZONE || "UTC";


// Wrap a job so a failure is logged but never crashes the scheduler or
// the server process.
const guard = (label, job) => {
    return async () => {
        try {
            await job();
        } catch (error) {
            console.error(`Scheduled job "${label}" failed:`, error);
        }
    };
};


const startScheduler = () => {

    if (process.env.SCHEDULER_ENABLED === "false") {
        console.log(
            "Scheduler disabled (SCHEDULER_ENABLED=false)."
        );

        return;
    }

    const options = { timezone: TIMEZONE };

    // Daily reminders at 08:00.
    cron.schedule(
        "0 8 * * *",
        guard("reminders", () => runReminders()),
        options
    );

    // Weekly report every Monday at 08:00.
    cron.schedule(
        "0 8 * * 1",
        guard("weekly-report", () => runReports("weekly")),
        options
    );

    // Monthly report on the 1st of the month at 08:00.
    cron.schedule(
        "0 8 1 * *",
        guard("monthly-report", () => runReports("monthly")),
        options
    );

    console.log(
        `Scheduler started (timezone: ${TIMEZONE}). ` +
        "Reminders daily 08:00; weekly report Mon 08:00; " +
        "monthly report 1st 08:00."
    );
};


module.exports = { startScheduler };
