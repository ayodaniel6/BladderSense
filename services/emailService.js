const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");


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


// How long an OTP remains valid. Kept in sync with the expiry the
// controllers set when they store the token, so the copy in the email
// always matches the real database expiry.
const OTP_EXPIRY_MINUTES = 5;


// Resolve the logo for the email header.
//
// Two supported sources, in priority order:
//   1. EMAIL_LOGO_URL  -> a publicly hosted image (best deliverability,
//      Gmail-safe).
//   2. assets/logo.png -> committed to the repo, attached inline via CID.
// If neither is available we fall back to a text wordmark so the email
// still renders cleanly.
const LOGO_CID = "bladdersense-logo";
const LOGO_FILE_PATH = path.join(__dirname, "..", "assets", "logo.png");

const resolveLogo = () => {
    if (process.env.EMAIL_LOGO_URL) {
        return {
            html: `
                <img
                    src="${process.env.EMAIL_LOGO_URL}"
                    alt="BladderSense"
                    width="64"
                    height="64"
                    style="display: block; border: 0;"
                />
            `,
            attachments: []
        };
    }

    if (fs.existsSync(LOGO_FILE_PATH)) {
        return {
            html: `
                <img
                    src="cid:${LOGO_CID}"
                    alt="BladderSense"
                    width="64"
                    height="64"
                    style="display: block; border: 0;"
                />
            `,
            attachments: [
                {
                    filename: "logo.png",
                    path: LOGO_FILE_PATH,
                    cid: LOGO_CID
                }
            ]
        };
    }

    return {
        html: `
            <div style="
                font-size: 22px;
                font-weight: bold;
                color: #1b5faa;
            ">
                BladderSense
            </div>
        `,
        attachments: []
    };
};


// Render the shared branded OTP email, mirroring the layout of the
// reference design: a coloured header band, a logo/wordmark row, a
// personalised greeting, the prominent code, an expiry line and a footer.
const renderOtpEmail = ({ name, code, intro }) => {
    const logo = resolveLogo();
    const greetingName = name ? ` ${name}` : "";
    const year = new Date().getFullYear();

    const html = `
        <div style="
            max-width: 600px;
            margin: 0 auto;
            font-family: Arial, Helvetica, sans-serif;
            color: #333333;
            background: #ffffff;
        ">
            <!-- Header band -->
            <div style="
                background: linear-gradient(90deg, #12a19a 0%, #1b5faa 100%);
                background-color: #1b5faa;
                padding: 24px 28px;
                color: #ffffff;
            ">
                <div style="font-size: 22px; font-weight: bold;">
                    BladderSense
                </div>
                <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">
                    Bladder Health Tracking &amp; Support
                </div>
            </div>

            <!-- Brand row -->
            <div style="
                padding: 24px 28px;
                border-bottom: 1px solid #eeeeee;
            ">
                <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="padding-right: 14px; vertical-align: middle;">
                            ${logo.html}
                        </td>
                        <td style="vertical-align: middle;">
                            <div style="
                                font-size: 22px;
                                font-weight: bold;
                                color: #1b5faa;
                            ">
                                BladderSense
                            </div>
                            <div style="font-size: 13px; color: #777777;">
                                Secure Account Access
                            </div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Body -->
            <div style="padding: 28px;">
                <p style="font-size: 20px; font-weight: bold; margin: 0 0 16px;">
                    Dear${greetingName},
                </p>

                <p style="font-size: 15px; margin: 0 0 20px;">
                    ${intro}
                </p>

                <div style="
                    text-align: center;
                    font-size: 40px;
                    font-weight: bold;
                    letter-spacing: 10px;
                    color: #111111;
                    margin: 28px 0;
                ">
                    ${code}
                </div>

                <p style="font-size: 15px; margin: 0 0 20px;">
                    This OTP is valid for the next
                    ${OTP_EXPIRY_MINUTES} minutes.
                </p>

                <p style="font-size: 15px; margin: 0 0 8px;">
                    If you did not initiate this request, please disregard
                    this message.
                </p>
                <p style="font-size: 15px; font-weight: bold; margin: 0 0 24px;">
                    Thank you.
                </p>

                <p style="font-size: 15px; margin: 0;">
                    Best regards,<br />
                    <strong>BladderSense</strong>
                </p>

                <p style="font-size: 12px; color: #999999; margin: 28px 0 0;">
                    This email cannot receive replies.
                </p>
            </div>

            <!-- Footer band -->
            <div style="
                background: #111111;
                color: #ffffff;
                padding: 18px 28px;
                font-size: 12px;
            ">
                &copy; BladderSense ${year}.<br />
                All Rights Reserved
            </div>
        </div>
    `;

    const text =
        `Dear${greetingName},\n\n` +
        `${intro}\n\n` +
        `Your OTP is: ${code}\n\n` +
        `This OTP is valid for the next ${OTP_EXPIRY_MINUTES} minutes.\n\n` +
        `If you did not initiate this request, please disregard this ` +
        `message.\nThank you.\n\n` +
        `Best regards,\nBladderSense`;

    return {
        html,
        text,
        attachments: logo.attachments
    };
};


// Send verification email
const sendVerificationEmail = async (email, token, name) => {

    if (process.env.EMAIL_ENABLED !== "true") {
        console.log(
            `[EMAIL DISABLED] Verification OTP for ${email}: ${token}`
        );

        return;
    }

    const { html, text, attachments } = renderOtpEmail({
        name,
        code: token,
        intro:
            "Welcome to BladderSense. Use the One-Time Password (OTP) " +
            "below to verify your email address and complete your " +
            "registration."
    });

    await transporter.sendMail({
        from: `"BladderSense" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: "Your BladderSense verification code",
        text,
        html,
        attachments
    });

    console.log(`Verification email sent to ${email}`);
};


// Send login email
const sendLoginEmail = async (email, token, name) => {

    if (process.env.EMAIL_ENABLED !== "true") {
        console.log(
            `[EMAIL DISABLED] Login OTP for ${email}: ${token}`
        );

        return;
    }

    const { html, text, attachments } = renderOtpEmail({
        name,
        code: token,
        intro: "Your One-Time Password (OTP) for signing in is:"
    });

    await transporter.sendMail({
        from: `"BladderSense" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: "Your BladderSense login code",
        text,
        html,
        attachments
    });

    console.log(`Login email sent to ${email}`);
};


module.exports = {
    sendVerificationEmail,
    sendLoginEmail
};
