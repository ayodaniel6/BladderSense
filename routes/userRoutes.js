const express = require("express");

const {
    getUsers,
    createUser
} = require("../controllers/userController");

const router = express.Router();

router.get("/users", getUsers);
router.post("/users", createUser);

module.exports = router;