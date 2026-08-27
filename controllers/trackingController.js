const pool = require("../database/db");

const {
    validateTrackingEntry
} = require("../utils/trackingValidation");


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


module.exports = {
    createTrackingEntry,
    getTrackingEntries,
    updateTrackingEntry
};