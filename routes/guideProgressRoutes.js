const express = require("express");

const requireAuth = require("../middleware/authMiddleware");

const {
    getGuideProgress,
    addGuideProgress,
    resetGuideProgress
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

router.delete(
    "/guide-progress",
    requireAuth,
    resetGuideProgress
);


module.exports = router;
