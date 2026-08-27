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