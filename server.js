const express = require("express");
const healthRoutes = require("./routes/healthRoutes");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const cookieParser = require("cookie-parser");
const testRoutes = require("./routes/testRoutes");
const profileRoutes = require("./routes/profileRoutes");
const trackingRoutes = require("./routes/trackingRoutes");
// const pool = require("./database/db");

const app = express();

const PORT = 5000;

app.use(express.json());
app.use(cookieParser());

app.use("/api", healthRoutes);
app.use("/api", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", testRoutes);
app.use("/api", profileRoutes);
app.use("/api", trackingRoutes);
app.listen(PORT, () => {
    console.log(`BladderSense server running on port ${PORT}`);
});
