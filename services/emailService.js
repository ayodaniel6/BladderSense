const nodemailer = require("nodemailer");


// Create the email transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === "true",

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});


// Send verification email
const sendVerificationEmail = async (email, token) => {

    if (process.env.EMAIL_ENABLED !== "true") {
        console.log(
            `[EMAIL DISABLED] Verification token for ${email}: ${token}`
        );

        return;
    }

    const verificationUrl =
        `${process.env.FRONTEND_URL}/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;


    await transporter.sendMail({
        from: `"BladderSense" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: "Verify your BladderSense email address",

        text:
            `Welcome to BladderSense.\n\n` +
            `Please verify your email address by visiting the following link:\n\n` +
            `${verificationUrl}\n\n` +
            `This verification link expires in 15 minutes.`,

        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Welcome to BladderSense</h2>

                <p>
                    Please verify your email address to complete
                    your registration.
                </p>

                <p>
                    <a
                        href="${verificationUrl}"
                        style="
                            display: inline-block;
                            padding: 12px 20px;
                            background: #333;
                            color: white;
                            text-decoration: none;
                            border-radius: 6px;
                        "
                    >
                        Verify Email Address
                    </a>
                </p>

                <p>
                    This verification link expires in 15 minutes.
                </p>

                <p>
                    If you did not create a BladderSense account,
                    you can safely ignore this email.
                </p>
            </div>
        `
    });

    console.log(`Verification email sent to ${email}`);
};


// Send login email
const sendLoginEmail = async (email, token) => {

    if (process.env.EMAIL_ENABLED !== "true") {
        console.log(
            `[EMAIL DISABLED] Login token for ${email}: ${token}`
        );

        return;
    }


    await transporter.sendMail({
        from: `"BladderSense" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: "Your BladderSense login code",

        text:
            `Your BladderSense login code is: ${token}\n\n` +
            `This code expires in 15 minutes.\n\n` +
            `If you did not request this code, you can safely ignore this email.`,

        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>BladderSense Login</h2>

                <p>
                    Use the following code to sign in:
                </p>

                <h1 style="letter-spacing: 5px;">
                    ${token}
                </h1>

                <p>
                    This code expires in 15 minutes.
                </p>

                <p>
                    If you did not request this login code,
                    you can safely ignore this email.
                </p>
            </div>
        `
    });

    console.log(`Login email sent to ${email}`);
};


module.exports = {
    sendVerificationEmail,
    sendLoginEmail
};