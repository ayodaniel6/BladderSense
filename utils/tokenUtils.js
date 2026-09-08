const crypto = require("crypto");

// Generate a six-digit numeric one-time password.
//
// A numeric code (000000–999999) is easier to read aloud and type,
// which matters for older users. crypto.randomInt gives a uniform,
// cryptographically secure value with no modulo bias. The result is
// zero-padded so it is always exactly six characters (e.g. "042317").
const generateToken = () => {
    return crypto
        .randomInt(0, 1000000)
        .toString()
        .padStart(6, "0");
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
