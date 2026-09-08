const express = require("express");

const requireAuth = require("../middleware/authMiddleware");

const {
    getReminderPreferences,
    updateReminderPreferences
} = require("../controllers/reminderController");

const router = express.Router();


router.get(
    "/reminders",
    requireAuth,
    getReminderPreferences
);

router.put(
    "/reminders",
    requireAuth,
    updateReminderPreferences
);


module.exports = router;
