const crypto = require("crypto");

const pool = require("../database/db");

const {
    generateToken,
    hashToken
} = require("../utils/tokenUtils");

const {
    sendVerificationEmail,
    sendLoginEmail
} = require("../services/emailService");


// ============================================================
// REGISTER
// ============================================================

const register = async (req, res) => {
    const client = await pool.connect();

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

        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await client.query(
            `
            SELECT id
            FROM users
            WHERE email = $1
            `,
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                error: "An account with this email already exists"
            });
        }

        const userId = crypto.randomUUID();
        const tokenId = crypto.randomUUID();

        // Generate token for the user
        const token = generateToken();

        // Store only the hash in the database
        const tokenHash = hashToken(token);

        const expiresAt = new Date(
            Date.now() + 15 * 60 * 1000
        );

        await client.query("BEGIN");

        // Create user
        await client.query(
            `
            INSERT INTO users (
                id,
                first_name,
                last_name,
                preferred_name,
                email
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                userId,
                firstName.trim(),
                lastName.trim(),
                preferredName
                    ? preferredName.trim()
                    : null,
                normalizedEmail
            ]
        );

        // Store hashed verification token
        await client.query(
            `
            INSERT INTO auth_tokens (
                id,
                user_id,
                token_hash,
                purpose,
                expires_at
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                tokenId,
                userId,
                tokenHash,
                "verification",
                expiresAt
            ]
        );

        await client.query("COMMIT");

        // Send the actual token, not the hash
        await sendVerificationEmail(
            normalizedEmail,
            token
        );

        res.status(201).json({
            message: "Registration successful",
            user: {
                id: userId,
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                preferredName: preferredName
                    ? preferredName.trim()
                    : null,
                email: normalizedEmail,
                emailVerified: false
            },

            verificationToken: token
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "Registration rollback error:",
                rollbackError
            );
        }

        console.error(
            "Registration error:",
            error
        );

        res.status(500).json({
            error: "Registration failed"
        });

    } finally {
        client.release();
    }
};


// ============================================================
// VERIFY EMAIL
// ============================================================

const verifyEmail = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            email,
            token
        } = req.body;

        if (!email || !token) {
            return res.status(400).json({
                error: "Email and verification token are required"
            });
        }

        const normalizedEmail = email
            .trim()
            .toLowerCase();

        const normalizedToken = token
            .trim()
            .toUpperCase();

        // Hash the token supplied by the user
        const tokenHash = hashToken(
            normalizedToken
        );

        await client.query("BEGIN");

        const userResult = await client.query(
            `
            SELECT id, email_verified
            FROM users
            WHERE email = $1
            `,
            [normalizedEmail]
        );

        if (userResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "User not found"
            });
        }

        const user = userResult.rows[0];

        if (user.email_verified) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Email is already verified"
            });
        }

        const tokenResult = await client.query(
            `
            SELECT id
            FROM auth_tokens
            WHERE user_id = $1
              AND token_hash = $2
              AND purpose = 'verification'
              AND used = FALSE
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [
                user.id,
                tokenHash
            ]
        );

        if (tokenResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Invalid or expired verification token"
            });
        }

        const authToken = tokenResult.rows[0];

        // Verify user
        await client.query(
            `
            UPDATE users
            SET email_verified = TRUE
            WHERE id = $1
            `,
            [user.id]
        );

        // Consume token
        await client.query(
            `
            UPDATE auth_tokens
            SET used = TRUE
            WHERE id = $1
            `,
            [authToken.id]
        );

        await client.query("COMMIT");

        res.json({
            message: "Email verified successfully"
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "Verification rollback error:",
                rollbackError
            );
        }

        console.error(
            "Email verification error:",
            error
        );

        res.status(500).json({
            error: "Email verification failed"
        });

    } finally {
        client.release();
    }
};


// ============================================================
// REQUEST LOGIN TOKEN
// ============================================================

const requestLogin = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                error: "Email is required"
            });
        }

        const normalizedEmail = email
            .trim()
            .toLowerCase();

        const userResult = await pool.query(
            `
            SELECT id, email_verified
            FROM users
            WHERE email = $1
            `,
            [normalizedEmail]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        const user = userResult.rows[0];

        if (!user.email_verified) {
            return res.status(403).json({
                error: "Email address has not been verified"
            });
        }

        const tokenId = crypto.randomUUID();

        // Generate login token
        const token = generateToken();

        // Store only its hash
        const tokenHash = hashToken(token);

        const expiresAt = new Date(
            Date.now() + 15 * 60 * 1000
        );

        await pool.query(
            `
            INSERT INTO auth_tokens (
                id,
                user_id,
                token_hash,
                purpose,
                expires_at
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                tokenId,
                user.id,
                tokenHash,
                "login",
                expiresAt
            ]
        );

        // Send plaintext token to the user
        await sendLoginEmail(
            normalizedEmail,
            token
        );

        res.json({
            message: "Login token generated",

            loginToken: token
        });

    } catch (error) {

        console.error(
            "Login token error:",
            error
        );

        res.status(500).json({
            error: "Failed to generate login token"
        });
    }
};


// ============================================================
// VERIFY LOGIN TOKEN
// ============================================================

const verifyLogin = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            email,
            token
        } = req.body;

        if (!email || !token) {
            return res.status(400).json({
                error: "Email and login token are required"
            });
        }

        const normalizedEmail = email
            .trim()
            .toLowerCase();

        const normalizedToken = token
            .trim()
            .toUpperCase();

        // Hash submitted token before comparing
        const tokenHash = hashToken(
            normalizedToken
        );

        await client.query("BEGIN");

        const userResult = await client.query(
            `
            SELECT
                id,
                first_name,
                last_name,
                preferred_name,
                email
            FROM users
            WHERE email = $1
              AND email_verified = TRUE
            `,
            [normalizedEmail]
        );

        if (userResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(401).json({
                error: "Invalid login credentials"
            });
        }

        const user = userResult.rows[0];

        const tokenResult = await client.query(
            `
            SELECT id
            FROM auth_tokens
            WHERE user_id = $1
              AND token_hash = $2
              AND purpose = 'login'
              AND used = FALSE
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [
                user.id,
                tokenHash
            ]
        );

        if (tokenResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(401).json({
                error: "Invalid or expired login token"
            });
        }

        const authToken = tokenResult.rows[0];

        // Consume login token
        await client.query(
            `
            UPDATE auth_tokens
            SET used = TRUE
            WHERE id = $1
            `,
            [authToken.id]
        );

        // Create session
        const sessionId = crypto.randomUUID();

        const sessionExpiresAt = new Date(
            Date.now() +
            7 * 24 * 60 * 60 * 1000
        );

        await client.query(
            `
            INSERT INTO sessions (
                id,
                user_id,
                expires_at
            )
            VALUES ($1, $2, $3)
            `,
            [
                sessionId,
                user.id,
                sessionExpiresAt
            ]
        );

        // Update last login
        await client.query(
            `
            UPDATE users
            SET last_login_at = NOW()
            WHERE id = $1
            `,
            [user.id]
        );

        await client.query("COMMIT");

        // Create authentication cookie
        res.cookie(
            "bladdersense_session",
            sessionId,
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                expires: sessionExpiresAt,
                maxAge: 7 * 24 * 60 * 60 * 1000
            }
        );

        res.json({
            message: "Login successful",

            user: {
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                preferredName: user.preferred_name,
                email: user.email
            }
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "Login rollback error:",
                rollbackError
            );
        }

        console.error(
            "Login verification error:",
            error
        );

        res.status(500).json({
            error: "Login failed"
        });

    } finally {
        client.release();
    }
};


// ============================================================
// LOGOUT
// ============================================================

const logout = async (req, res) => {
    try {
        const sessionId =
            req.cookies.bladdersense_session;

        if (sessionId) {
            await pool.query(
                `
                DELETE FROM sessions
                WHERE id = $1
                `,
                [sessionId]
            );
        }

        res.clearCookie(
            "bladdersense_session"
        );

        res.json({
            message: "Logged out successfully"
        });

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        res.status(500).json({
            error: "Logout failed"
        });
    }
};

// ============================================================
// RESEND VERIFICATION TOKEN
// ============================================================

const resendVerification = async (req, res) => {
    const client = await pool.connect();

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                error: "Email is required"
            });
        }

        const normalizedEmail = email
            .trim()
            .toLowerCase();

        await client.query("BEGIN");

        // Find user
        const userResult = await client.query(
            `
            SELECT id, email_verified
            FROM users
            WHERE email = $1
            `,
            [normalizedEmail]
        );

        if (userResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "User not found"
            });
        }

        const user = userResult.rows[0];

        // Don't issue verification tokens to already verified users
        if (user.email_verified) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Email address is already verified"
            });
        }

        // Invalidate previous verification tokens
        await client.query(
            `
            UPDATE auth_tokens
            SET used = TRUE
            WHERE user_id = $1
              AND purpose = 'verification'
              AND used = FALSE
            `,
            [user.id]
        );

        // Generate new token
        const tokenId = crypto.randomUUID();
        const token = generateToken();
        const tokenHash = hashToken(token);

        const expiresAt = new Date(
            Date.now() + 15 * 60 * 1000
        );

        // Store hashed token
        await client.query(
            `
            INSERT INTO auth_tokens (
                id,
                user_id,
                token_hash,
                purpose,
                expires_at
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                tokenId,
                user.id,
                tokenHash,
                "verification",
                expiresAt
            ]
        );

        await client.query("COMMIT");

        // Send the actual token by email
        await sendVerificationEmail(
            normalizedEmail,
            token
        );

        const response = {
            message: "Verification token sent"
        };

        // Development only
        if (process.env.NODE_ENV !== "production") {
            response.verificationToken = token;
        }

        res.json(response);

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "Resend verification rollback error:",
                rollbackError
            );
        }

        console.error(
            "Resend verification error:",
            error
        );

        res.status(500).json({
            error: "Failed to resend verification token"
        });

    } finally {
        client.release();
    }
};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    register,
    verifyEmail,
    resendVerification,
    requestLogin,
    verifyLogin,
    logout
};