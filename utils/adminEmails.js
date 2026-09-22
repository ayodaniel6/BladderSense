const pool = require("../database/db");

/*
 * Admin accounts can be set with the ADMIN_EMAILS environment variable
 * (comma-separated), so no email addresses need to live in the code:
 *
 *   ADMIN_EMAILS=owner@example.com,colleague@example.com
 *
 * Listed accounts are promoted when the server starts and whenever they
 * sign in, so an account registered later becomes an admin on its first
 * login. Removing an email from the list does not demote it; do that
 * from the dashboard or with `npm run make-admin -- <email> --revoke`.
 */
const getAdminEmails = () =>
    (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);


const isConfiguredAdmin = (email) =>
    getAdminEmails().includes(
        String(email || "").trim().toLowerCase()
    );


// Promote every listed account that already exists.
const syncAdminEmails = async () => {
    const emails = getAdminEmails();

    if (emails.length === 0) {
        return;
    }

    try {
        const result = await pool.query(
            `
            UPDATE users
            SET is_admin = TRUE
            WHERE email = ANY($1)
              AND is_admin = FALSE
            `,
            [emails]
        );

        if (result.rowCount > 0) {
            console.log(
                `Granted admin to ${result.rowCount} account(s) from ADMIN_EMAILS`
            );
        }

    } catch (error) {
        console.error("Failed to sync ADMIN_EMAILS:", error);
    }
};


module.exports = {
    isConfiguredAdmin,
    syncAdminEmails
};
