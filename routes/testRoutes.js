const express = require("express");

const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
    "/test",
    requireAuth,
    (req, res) => {

        res.json({
            message: "You are authenticated!",
            user: req.user
        });

    }
);

module.exports = router;