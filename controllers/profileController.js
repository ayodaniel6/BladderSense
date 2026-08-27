const pool = require("../database/db");

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

        const user = result.rows[0];

        res.json({
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                preferredName: user.preferred_name,
                email: user.email,
                emailVerified: user.email_verified,
                createdAt: user.created_at,
                lastLoginAt: user.last_login_at
            }
        });

    } catch (error) {

        console.error("Get profile error:", error);

        res.status(500).json({
            error: "Failed to retrieve profile"
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            preferredName
        } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({
                error: "First name and last name are required"
            });
        }

        const cleanFirstName = firstName.trim();
        const cleanLastName = lastName.trim();
        const cleanPreferredName = preferredName
            ? preferredName.trim()
            : null;

        if (!cleanFirstName || !cleanLastName) {
            return res.status(400).json({
                error: "First name and last name cannot be empty"
            });
        }

        const result = await pool.query(
            `
            UPDATE users
            SET
                first_name = $1,
                last_name = $2,
                preferred_name = $3
            WHERE id = $4
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
                cleanFirstName,
                cleanLastName,
                cleanPreferredName,
                req.user.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        const user = result.rows[0];

        res.json({
            message: "Profile updated successfully",
            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                preferredName: user.preferred_name,
                email: user.email,
                emailVerified: user.email_verified,
                createdAt: user.created_at,
                lastLoginAt: user.last_login_at
            }
        });

    } catch (error) {

        console.error("Update profile error:", error);

        res.status(500).json({
            error: "Failed to update profile"
        });
    }
};

module.exports = {
    getProfile,
    updateProfile
};