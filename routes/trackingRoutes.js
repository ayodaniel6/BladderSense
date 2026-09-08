const express = require("express");

const requireAuth = require("../middleware/authMiddleware");

const {
    createTrackingEntry,
    getTrackingEntries,
    updateTrackingEntry,
    getTrackingSummary
} = require("../controllers/trackingController");

const router = express.Router();


router.post(
    "/tracking",
    requireAuth,
    createTrackingEntry
);

router.get(
    "/tracking",
    requireAuth,
    getTrackingEntries
);

router.get(
    "/tracking/summary",
    requireAuth,
    getTrackingSummary
);

router.put(
    "/tracking/:id",
    requireAuth,
    updateTrackingEntry
);


module.exports = router;