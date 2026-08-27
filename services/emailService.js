const sendVerificationEmail = async (email, token) => {

    if (process.env.EMAIL_ENABLED !== "true") {
        console.log(
            `[EMAIL DISABLED] Verification token for ${email}: ${token}`
        );

        return;
    }

    // Real email provider will be implemented here.
    console.log(
        `Sending verification email to ${email}`
    );
};

const sendLoginEmail = async (email, token) => {

    if (process.env.EMAIL_ENABLED !== "true") {
        console.log(
            `[EMAIL DISABLED] Login token for ${email}: ${token}`
        );

        return;
    }

    // Real email provider will be implemented here.
    console.log(
        `Sending login email to ${email}`
    );
};

module.exports = {
    sendVerificationEmail,
    sendLoginEmail
};