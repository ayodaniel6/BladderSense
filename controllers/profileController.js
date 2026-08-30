const pool = require("../database/db");

const formatUser = (user) => ({
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    preferredName: user.preferred_name,
    email: user.email,
    emailVerified: user.email_verified,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at
});

const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                id,
                first_name,
                last_name,
                preferred_name,
                email,
                email_verified,
                created_at,
                last_login_at
            FROM users
            WHERE id = $1
            `,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        return res.json({
            user: formatUser(result.rows[0])
        });
    } catch (error) {
        console.error("Get profile error:", error);

        return res.status(500).json({
            error: "Failed to retrieve profile"
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { preferredName } = req.body || {};

        // Preferred name is currently the only editable profile field.
        if (
            preferredName !== undefined &&
            typeof preferredName !== "string"
        ) {
            return res.status(400).json({
                error: "Preferred name must be text"
            });
        }

        if (preferredName === undefined) {
            return res.status(400).json({
                error: "No profile changes were provided"
            });
        }

        const cleanPreferredName = preferredName.trim();

        const result = await pool.query(
            `
            UPDATE users
            SET preferred_name = $1
            WHERE id = $2
            RETURNING
                id,
                first_name,
                last_name,
                preferred_name,
                email,
                email_verified,
                created_at,
                last_login_at
            `,
            [
                cleanPreferredName || null,
                req.user.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        return res.json({
            message: "Profile updated successfully",
            user: formatUser(result.rows[0])
        });
    } catch (error) {
        console.error("Update profile error:", error);

        return res.status(500).json({
            error: "Failed to update profile"
        });
    }
};

module.exports = {
    getProfile,
    updateProfile
};