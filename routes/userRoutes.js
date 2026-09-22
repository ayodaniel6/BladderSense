const express = require("express");

const {
    getUsers,
    createUser
} = require("../controllers/userController");

const requireAuth = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

// These expose every user record and create unverified users directly,
// so they are restricted to admins.
router.get("/users", requireAuth, requireAdmin, getUsers);
router.post("/users", requireAuth, requireAdmin, createUser);

module.exports = router;