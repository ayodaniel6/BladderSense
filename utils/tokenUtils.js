const crypto = require("crypto");

const generateToken = () => {
    return crypto.randomBytes(3).toString("hex").toUpperCase();
};

const hashToken = (token) => {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
};

module.exports = {
    generateToken,
    hashToken
};