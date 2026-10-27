const pool = require("../database/db");


// The guide's section ids, as used by the frontend. Anything else is
// rejected so the table only ever holds real guide parts.
const GUIDE_SECTION_IDS = [
    "welcome",
    "why-4-areas",
    "how-to-use",
    "night-time",
    "sleep",
    "movement",
    "stress",
    "pelvic-floor",
    "practical-support",
    "personal-plan",
    "tips",
    "seek-help",
    "final-message"
];


const fetchReadSections = async (userId) => {
    const result = await pool.query(
        `
        SELECT section_id
        FROM guide_progress
        WHERE user_id = $1
        ORDER BY read_at ASC
        `,
        [userId]
    );

    return result.rows.map(row => row.section_id);
};


const getGuideProgress = async (req, res) => {
    try {
        res.json({
            readSections: await fetchReadSections(req.user.id)
        });

    } catch (error) {

        console.error("Get guide progress error:", error);

        res.status(500).json({
            error: "Failed to retrieve guide progress"
        });
    }
};


// Add one or more section ids to the user's read set. Idempotent:
// repeating an id is a no-op, and nothing is ever removed.
const addGuideProgress = async (req, res) => {
    try {
        const { sectionIds } = req.body || {};

        if (
            !Array.isArray(sectionIds) ||
            sectionIds.length === 0
        ) {
            return res.status(400).json({
                error: "sectionIds must be a non-empty list"
            });
        }

        const invalid = sectionIds.filter(
            id => !GUIDE_SECTION_IDS.includes(id)
        );

        if (invalid.length > 0) {
            return res.status(400).json({
                error: "Validation failed",
                fields: {
                    sectionIds: `Unknown guide section: ${invalid.join(", ")}`
                }
            });
        }

        await pool.query(
            `
            INSERT INTO guide_progress (user_id, section_id)
            SELECT $1, UNNEST($2::varchar[])
            ON CONFLICT (user_id, section_id) DO NOTHING
            `,
            [
                req.user.id,
                [...new Set(sectionIds)]
            ]
        );

        res.json({
            readSections: await fetchReadSections(req.user.id)
        });

    } catch (error) {

        console.error("Add guide progress error:", error);

        res.status(500).json({
            error: "Failed to save guide progress"
        });
    }
};


module.exports = {
    getGuideProgress,
    addGuideProgress
};
