/*
 * Grant (or revoke) admin access for an existing, verified account.
 *
 *   npm run make-admin -- someone@example.com
 *   npm run make-admin -- someone@example.com --revoke
 *
 * On Heroku: heroku run npm run make-admin -- someone@example.com
 */
const pool = require("../database/db");

const run = async () => {
    const email = (process.argv[2] || "").trim().toLowerCase();
    const revoke = process.argv.includes("--revoke");

    if (!email || email.startsWith("--")) {
        console.error(
            "Usage: npm run make-admin -- <email> [--revoke]"
        );
        process.exitCode = 1;
        return;
    }

    try {
        const result = await pool.query(
            `
            UPDATE users
            SET is_admin = $1
            WHERE email = $2
            RETURNING email, is_admin
            `,
            [!revoke, email]
        );

        if (result.rows.length === 0) {
            console.error(
                `No user found with email ${email}. ` +
                "They need to register first."
            );
            process.exitCode = 1;
            return;
        }

        console.log(
            revoke
                ? `Admin access removed from ${email}`
                : `${email} is now an admin`
        );

    } catch (error) {
        console.error("Failed to update admin access:", error);
        process.exitCode = 1;

    } finally {
        await pool.end();
    }
};

run();
