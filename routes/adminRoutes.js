const express = require("express");

const requireAuth = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const {
    getStats,
    listUsers,
    getUser,
    updateUser,
    revokeSessions,
    deleteUser
} = require("../controllers/adminController");

const router = express.Router();

// Every admin route requires a signed-in admin.
router.use(requireAuth, requireAdmin);

router.get("/stats", getStats);
router.get("/users", listUsers);
router.get("/users/:id", getUser);
router.patch("/users/:id", updateUser);
router.post("/users/:id/logout", revokeSessions);
router.delete("/users/:id", deleteUser);

module.exports = router;
