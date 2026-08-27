const crypto = require("crypto");
const pool = require("../database/db");

const getUsers = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM users");

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching users:", error);

        res.status(500).json({
            error: "Failed to fetch users"
        });
    }
};

const createUser = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            preferredName,
            email
        } = req.body;

        if (!firstName || !lastName || !email) {
            return res.status(400).json({
                error: "First name, last name, and email are required"
            });
        }

        const id = crypto.randomUUID();

        const result = await pool.query(
            `
            INSERT INTO users (
                id,
                first_name,
                last_name,
                preferred_name,
                email
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            `,
            [
                id,
                firstName,
                lastName,
                preferredName || null,
                email
            ]
        );

        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error("Error creating user:", error);

        res.status(500).json({
            error: "Failed to create user"
        });
    }
};

module.exports = {
    getUsers,
    createUser
};