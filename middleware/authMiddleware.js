const pool = require("../database/db");

const requireAuth = async (req, res, next) => {
    try {
        const sessionId = req.cookies.bladdersense_session;

        // No session cookie
        if (!sessionId) {
            return res.status(401).json({
                error: "Authentication required"
            });
        }

        const result = await pool.query(
            `
            SELECT
                sessions.id AS session_id,
                sessions.expires_at,
                users.id,
                users.first_name,
                users.last_name,
                users.preferred_name,
                users.email,
                users.email_verified
            FROM sessions
            INNER JOIN users
                ON sessions.user_id = users.id
            WHERE sessions.id = $1
            `,
            [sessionId]
        );

        // Session does not exist
        if (result.rows.length === 0) {
            return res.status(401).json({
                error: "Invalid session"
            });
        }

        const user = result.rows[0];

        // Session has expired
        if (new Date(user.expires_at) < new Date()) {

            // Clean up expired session
            await pool.query(
                `
                DELETE FROM sessions
                WHERE id = $1
                `,
                [sessionId]
            );

            res.clearCookie("bladdersense_session");

            return res.status(401).json({
                error: "Session expired"
            });
        }

        // Attach authenticated user to request
        req.user = {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            preferredName: user.preferred_name,
            email: user.email,
            emailVerified: user.email_verified
        };

        // Continue to the next middleware/controller
        next();

    } catch (error) {

        console.error(
            "Authentication middleware error:",
            error
        );

        res.status(500).json({
            error: "Authentication check failed"
        });
    }
};

module.exports = requireAuth;