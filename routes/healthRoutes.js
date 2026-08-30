const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Hello, This is Daniel Ayodeji."
    });
});

module.exports = router;
