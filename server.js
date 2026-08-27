const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const healthRoutes = require("./routes/healthRoutes");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const trackingRoutes = require("./routes/trackingRoutes");

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


// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log(
        `BladderSense server running on port ${PORT}`
    );
});