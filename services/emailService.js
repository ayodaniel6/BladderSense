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


// Render a branded tracking reminder email. Mirrors the header/footer
// styling of the OTP email but carries a call-to-action to return to the
// app and log a tracking entry.
const renderReminderEmail = ({ name, appUrl, frequency }) => {
    const logo = resolveLogo();
    const greetingName = name ? ` ${name}` : "";
    const year = new Date().getFullYear();

    const cadenceLine =
        frequency === "weekly"
            ? "It's the start of a new week — a great time to check in " +
              "on your bladder health."
            : "This is your daily reminder to log today's entry.";

    const ctaButton = appUrl
        ? `
            <div style="text-align: center; margin: 28px 0;">
                <a
                    href="${appUrl}"
                    style="
                        display: inline-block;
                        background: #1b5faa;
                        color: #ffffff;
                        text-decoration: none;
                        font-size: 16px;
                        font-weight: bold;
                        padding: 14px 28px;
                        border-radius: 6px;
                    "
                >
                    Track today
                </a>
            </div>
        `
        : "";

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
                                Tracking Reminder
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
                    ${cadenceLine} Consistent tracking helps you and your
                    care team spot patterns and measure your progress.
                </p>

                ${ctaButton}

                <p style="font-size: 15px; margin: 0 0 8px;">
                    You are receiving this because tracking reminders are
                    switched on for your account. You can turn them off at
                    any time from your reminder settings.
                </p>

                <p style="font-size: 15px; margin: 24px 0 0;">
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
        `${cadenceLine} Consistent tracking helps you and your care ` +
        `team spot patterns and measure your progress.\n\n` +
        (appUrl ? `Track today: ${appUrl}\n\n` : "") +
        `You are receiving this because tracking reminders are switched ` +
        `on for your account. You can turn them off at any time from ` +
        `your reminder settings.\n\n` +
        `Best regards,\nBladderSense`;

    return {
        html,
        text,
        attachments: logo.attachments
    };
};


// Turn a distribution object ({ label: count }) into HTML table rows.
const distributionRowsHtml = (distribution) => {
    return Object.entries(distribution)
        .map(
            ([label, count]) => `
                <tr>
                    <td style="
                        padding: 6px 10px;
                        border-bottom: 1px solid #eeeeee;
                        color: #555555;
                    ">${label}</td>
                    <td style="
                        padding: 6px 10px;
                        border-bottom: 1px solid #eeeeee;
                        text-align: right;
                        font-weight: bold;
                    ">${count}</td>
                </tr>
            `
        )
        .join("");
};


// Turn a distribution object into plain-text lines.
const distributionLinesText = (distribution) => {
    return Object.entries(distribution)
        .map(([label, count]) => `    ${label}: ${count}`)
        .join("\n");
};


// Render a plain-figures report of a tracking summary. No commentary or
// interpretation is added — the email presents the recorded numbers only.
const renderReportEmail = ({ name, appUrl, period, summary }) => {
    const logo = resolveLogo();
    const greetingName = name ? ` ${name}` : "";
    const year = new Date().getFullYear();

    const periodLabel = period === "weekly" ? "Weekly" : "Monthly";

    const dash = "—";

    const nightAvg =
        summary.nightTimeUrination.averagePerNight === null
            ? dash
            : summary.nightTimeUrination.averagePerNight;

    const stressAvg =
        summary.stressLevel.average === null
            ? dash
            : summary.stressLevel.average;

    const sleepAvg =
        summary.sleepQuality.average === null
            ? dash
            : summary.sleepQuality.average;


    const sectionTable = (title, rowsHtml) => `
        <h3 style="
            font-size: 15px;
            color: #1b5faa;
            margin: 24px 0 8px;
        ">${title}</h3>
        <table
            role="presentation"
            cellpadding="0"
            cellspacing="0"
            width="100%"
            style="font-size: 14px; border-collapse: collapse;"
        >
            ${rowsHtml}
        </table>
    `;

    const metricRow = (label, value) => `
        <tr>
            <td style="
                padding: 6px 10px;
                border-bottom: 1px solid #eeeeee;
                color: #555555;
            ">${label}</td>
            <td style="
                padding: 6px 10px;
                border-bottom: 1px solid #eeeeee;
                text-align: right;
                font-weight: bold;
            ">${value}</td>
        </tr>
    `;


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
                    ${periodLabel} Tracking Report
                </div>
            </div>

            <!-- Body -->
            <div style="padding: 28px;">
                <p style="font-size: 18px; font-weight: bold; margin: 0 0 8px;">
                    Dear${greetingName},
                </p>

                <p style="font-size: 14px; margin: 0 0 4px;">
                    Here is your ${periodLabel.toLowerCase()} tracking
                    report.
                </p>
                <p style="font-size: 14px; color: #777777; margin: 0 0 8px;">
                    Period: ${summary.period.startDate} to
                    ${summary.period.endDate}
                    (${summary.period.days} days)
                </p>

                ${sectionTable(
                    "Adherence",
                    metricRow(
                        "Days tracked",
                        `${summary.adherence.daysTracked} of ` +
                        `${summary.adherence.expectedDays} ` +
                        `(${summary.adherence.percent}%)`
                    )
                )}

                ${sectionTable(
                    "Night-time urination",
                    metricRow("Average per night", nightAvg) +
                    distributionRowsHtml(
                        summary.nightTimeUrination.distribution
                    )
                )}

                ${sectionTable(
                    "Evening fluids",
                    distributionRowsHtml(
                        summary.eveningFluids.distribution
                    )
                )}

                ${sectionTable(
                    "Activity level",
                    distributionRowsHtml(
                        summary.activityLevel.distribution
                    )
                )}

                ${sectionTable(
                    "Stress level",
                    metricRow("Average (1-5)", stressAvg)
                )}

                ${sectionTable(
                    "Sleep quality",
                    metricRow("Average (Poor 1 - Good 3)", sleepAvg) +
                    distributionRowsHtml(
                        summary.sleepQuality.distribution
                    )
                )}

                ${
                    appUrl
                        ? `
                            <p style="font-size: 14px; margin: 28px 0 0;">
                                <a href="${appUrl}" style="color: #1b5faa;">
                                    Open BladderSense
                                </a>
                            </p>
                        `
                        : ""
                }

                <p style="font-size: 14px; margin: 24px 0 0;">
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
        `Here is your ${periodLabel.toLowerCase()} tracking report.\n` +
        `Period: ${summary.period.startDate} to ` +
        `${summary.period.endDate} (${summary.period.days} days)\n\n` +
        `Adherence\n` +
        `    Days tracked: ${summary.adherence.daysTracked} of ` +
        `${summary.adherence.expectedDays} ` +
        `(${summary.adherence.percent}%)\n\n` +
        `Night-time urination\n` +
        `    Average per night: ${nightAvg}\n` +
        `${distributionLinesText(
            summary.nightTimeUrination.distribution
        )}\n\n` +
        `Evening fluids\n` +
        `${distributionLinesText(summary.eveningFluids.distribution)}\n\n` +
        `Activity level\n` +
        `${distributionLinesText(summary.activityLevel.distribution)}\n\n` +
        `Stress level\n` +
        `    Average (1-5): ${stressAvg}\n\n` +
        `Sleep quality\n` +
        `    Average (Poor 1 - Good 3): ${sleepAvg}\n` +
        `${distributionLinesText(summary.sleepQuality.distribution)}\n\n` +
        `Best regards,\nBladderSense`;

    return {
        html,
        text,
        attachments: logo.attachments
    };
};


// Send a tracking report email (weekly or monthly). The report contains
// the recorded figures only.
const sendReportEmail = async (email, name, options = {}) => {

    const { period = "monthly", summary } = options;
    const appUrl = process.env.FRONTEND_URL || "";

    if (process.env.EMAIL_ENABLED !== "true") {
        console.log(
            `[EMAIL DISABLED] ${period} report for ${email}`
        );

        return;
    }

    const { html, text, attachments } = renderReportEmail({
        name,
        appUrl,
        period,
        summary
    });

    const periodLabel = period === "weekly" ? "weekly" : "monthly";

    await transporter.sendMail({
        from: `"BladderSense" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: `Your BladderSense ${periodLabel} report`,
        text,
        html,
        attachments
    });

    console.log(`${period} report email sent to ${email}`);
};


// Send a tracking reminder email.
const sendReminderEmail = async (email, name, options = {}) => {

    const { frequency = "daily" } = options;
    const appUrl = process.env.FRONTEND_URL || "";

    if (process.env.EMAIL_ENABLED !== "true") {
        console.log(
            `[EMAIL DISABLED] Tracking reminder for ${email} ` +
            `(frequency: ${frequency})`
        );

        return;
    }

    const { html, text, attachments } = renderReminderEmail({
        name,
        appUrl,
        frequency
    });

    await transporter.sendMail({
        from: `"BladderSense" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: "Time to track with BladderSense",
        text,
        html,
        attachments
    });

    console.log(`Reminder email sent to ${email}`);
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
    sendLoginEmail,
    sendReminderEmail,
    sendReportEmail
};
