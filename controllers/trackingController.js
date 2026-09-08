const pool = require("../database/db");

const {
    validateTrackingEntry
} = require("../utils/trackingValidation");

const {
    buildTrackingSummary
} = require("../utils/trackingSummary");


// Default tracking window. The doctor's guidance is a 30-day tracking
// period with a monthly progress summary; callers may request a
// different window with ?days= (bounded to a sensible range).
const DEFAULT_SUMMARY_DAYS = 30;
const MAX_SUMMARY_DAYS = 90;
const MIN_SUMMARY_DAYS = 1;


const createTrackingEntry = async (req, res) => {
    try {
        const {
            entryDate,
            nightTimeUrination,
            eveningFluids,
            activityLevel,
            stressLevel,
            sleepQuality,
            notes
        } = req.body;


        // Validate the submitted data
        const errors = validateTrackingEntry(req.body);

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                error: "Validation failed",
                fields: errors
            });
        }


        // Insert the tracking entry
        const result = await pool.query(
            `
            INSERT INTO tracking_entries (
                user_id,
                entry_date,
                night_time_urination,
                evening_fluids,
                activity_level,
                stress_level,
                sleep_quality,
                notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
                id,
                entry_date,
                night_time_urination,
                evening_fluids,
                activity_level,
                stress_level,
                sleep_quality,
                notes,
                updated_at
            `,
            [
                req.user.id,
                entryDate,
                nightTimeUrination,
                eveningFluids,
                activityLevel,
                stressLevel,
                sleepQuality,
                notes || null
            ]
        );


        const entry = result.rows[0];


        res.status(201).json({
            message: "Tracking entry created successfully",
            entry: {
                id: entry.id,
                entryDate: entry.entry_date,
                nightTimeUrination: entry.night_time_urination,
                eveningFluids: entry.evening_fluids,
                activityLevel: entry.activity_level,
                stressLevel: entry.stress_level,
                sleepQuality: entry.sleep_quality,
                notes: entry.notes,
                updatedAt: entry.updated_at
            }
        });

    } catch (error) {

        // PostgreSQL unique constraint violation
        if (error.code === "23505") {
            return res.status(409).json({
                error: "A tracking entry already exists for this date"
            });
        }


        console.error(
            "Create tracking entry error:",
            error
        );

        res.status(500).json({
            error: "Failed to create tracking entry"
        });
    }
};

const getTrackingEntries = async (req, res) => {
    try {
        const result = await pool.query(
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
            `,
            [req.user.id]
        );

        const entries = result.rows.map((entry) => ({
            id: entry.id,
            entryDate: entry.entry_date,
            nightTimeUrination: entry.night_time_urination,
            eveningFluids: entry.evening_fluids,
            activityLevel: entry.activity_level,
            stressLevel: entry.stress_level,
            sleepQuality: entry.sleep_quality,
            notes: entry.notes,
            updatedAt: entry.updated_at
        }));

        res.json({
            entries
        });

    } catch (error) {

        console.error(
            "Get tracking entries error:",
            error
        );

        res.status(500).json({
            error: "Failed to retrieve tracking entries"
        });
    }
};

const updateTrackingEntry = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            nightTimeUrination,
            eveningFluids,
            activityLevel,
            stressLevel,
            sleepQuality,
            notes
        } = req.body;


        // Validate the submitted values
        const errors = validateTrackingEntry({
            entryDate: "existing",
            nightTimeUrination,
            eveningFluids,
            activityLevel,
            stressLevel,
            sleepQuality,
            notes
        });


        // We don't need to validate entryDate
        delete errors.entryDate;


        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                error: "Validation failed",
                fields: errors
            });
        }


        const result = await pool.query(
            `
            UPDATE tracking_entries
            SET
                night_time_urination = $1,
                evening_fluids = $2,
                activity_level = $3,
                stress_level = $4,
                sleep_quality = $5,
                notes = $6,
                updated_at = NOW()
            WHERE id = $7
              AND user_id = $8
            RETURNING
                id,
                entry_date,
                night_time_urination,
                evening_fluids,
                activity_level,
                stress_level,
                sleep_quality,
                notes,
                updated_at
            `,
            [
                nightTimeUrination,
                eveningFluids,
                activityLevel,
                stressLevel,
                sleepQuality,
                notes || null,
                id,
                req.user.id
            ]
        );


        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Tracking entry not found"
            });
        }


        const entry = result.rows[0];


        res.json({
            message: "Tracking entry updated successfully",
            entry: {
                id: entry.id,
                entryDate: entry.entry_date,
                nightTimeUrination: entry.night_time_urination,
                eveningFluids: entry.evening_fluids,
                activityLevel: entry.activity_level,
                stressLevel: entry.stress_level,
                sleepQuality: entry.sleep_quality,
                notes: entry.notes,
                updatedAt: entry.updated_at
            }
        });

    } catch (error) {

        console.error(
            "Update tracking entry error:",
            error
        );

        res.status(500).json({
            error: "Failed to update tracking entry"
        });
    }
};


const getTrackingSummary = async (req, res) => {
    try {

        // Resolve and clamp the requested window length.
        let periodDays = Number.parseInt(req.query.days, 10);

        if (!Number.isFinite(periodDays)) {
            periodDays = DEFAULT_SUMMARY_DAYS;
        }

        periodDays = Math.min(
            Math.max(periodDays, MIN_SUMMARY_DAYS),
            MAX_SUMMARY_DAYS
        );


        // Pull only the entries that fall inside the window. The window
        // ends today and spans `periodDays` days (inclusive).
        const result = await pool.query(
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
            [req.user.id, periodDays]
        );


        const summary = buildTrackingSummary(
            result.rows,
            periodDays,
            new Date()
        );


        res.json({ summary });

    } catch (error) {

        console.error(
            "Get tracking summary error:",
            error
        );

        res.status(500).json({
            error: "Failed to generate tracking summary"
        });
    }
};


module.exports = {
    createTrackingEntry,
    getTrackingEntries,
    updateTrackingEntry,
    getTrackingSummary
};