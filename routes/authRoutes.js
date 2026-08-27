const express = require("express");

const {
    register,
    verifyEmail,
    resendVerification,
    requestLogin,
    verifyLogin, 
    logout
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post(
    "/resend-verification",
    resendVerification
);
router.post("/request-login", requestLogin);
router.post("/verify-login", verifyLogin);
router.post("/logout", logout);

module.exports = router;