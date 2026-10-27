const SESSION_COOKIE_NAME = "bladdersense_session";

// The frontend reaches the API through a same-origin Netlify proxy, so
// the cookie is first-party and SameSite=Lax is enough. No Domain
// attribute is set on purpose: a host-only cookie lets the proxy
// re-attribute it to the site's own domain, whereas pinning it to the
// Heroku host makes iOS browsers drop it.
const baseCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
});

const setSessionCookie = (res, sessionId, expiresAt) => {
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
        ...baseCookieOptions(),
        expires: expiresAt
    });
};

// Must use the same attributes as when the cookie was set, or some
// browsers keep the old cookie.
const clearSessionCookie = (res) => {
    res.clearCookie(SESSION_COOKIE_NAME, baseCookieOptions());
};

module.exports = {
    SESSION_COOKIE_NAME,
    setSessionCookie,
    clearSessionCookie
};
