const express = require("express");
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const healthRoutes = require("./routes/healthRoutes");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const trackingRoutes = require("./routes/trackingRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const adminRoutes = require("./routes/adminRoutes");

const { startScheduler } = require("./scheduler");

const app = express();

const PORT = process.env.PORT || 5000;


// ============================================================
// SECURITY
// ============================================================

app.use(helmet());


// ============================================================
// CORS
// ============================================================

app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true
    })
);


// ============================================================
// BODY / COOKIE PARSING
// ============================================================

app.use(express.json());
app.use(cookieParser());


// ============================================================
// ROUTES
// ============================================================

app.use("/api", healthRoutes);
app.use("/api", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", trackingRoutes);
app.use("/api", reminderRoutes);
app.use("/api/admin", adminRoutes);


// ============================================================
// ADMIN DASHBOARD (static page, data comes from /api/admin)
// ============================================================

app.use(
    "/admin",
    express.static(path.join(__dirname, "public", "admin"))
);


// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log(
        `BladderSense server running on port ${PORT}`
    );

    // Start the automated reminder/report scheduler.
    startScheduler();
});