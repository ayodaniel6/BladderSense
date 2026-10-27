const express = require("express");

const requireAuth = require("../middleware/authMiddleware");

const {
    getGuideProgress,
    addGuideProgress
} = require("../controllers/guideProgressController");

const router = express.Router();


router.get(
    "/guide-progress",
    requireAuth,
    getGuideProgress
);

router.post(
    "/guide-progress",
    requireAuth,
    addGuideProgress
);


module.exports = router;
