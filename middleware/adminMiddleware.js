/*
 * Restricts a route to admin accounts.
 *
 * Must run after requireAuth, which loads the signed-in user
 * (including users.is_admin) onto req.user.
 */
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({
            error: "Admin access required"
        });
    }

    next();
};

module.exports = requireAdmin;
