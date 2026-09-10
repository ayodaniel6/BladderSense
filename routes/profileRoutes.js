const express = require("express");

const requireAuth = require("../middleware/authMiddleware");

const {
    getProfile,
    updateProfile,
    deleteAccount
} = require("../controllers/profileController");

const router = express.Router();

router.get(
    "/profile",
    requireAuth,
    getProfile
);

router.put(
    "/profile",
    requireAuth,
    updateProfile
);

router.delete(
    "/profile",
    requireAuth,
    deleteAccount
);

module.exports = router;