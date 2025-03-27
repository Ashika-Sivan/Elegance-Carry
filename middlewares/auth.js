const User = require("../models/userSchema");


// User Authentication Middleware
const userAuth = async (req, res, next) => {
    try {
        
        // Add this before database query
     if (!req.session.user||!req.session.user.match(/^[0-9a-fA-F]{24}$/)) {
      return res.redirect("/login");
}

        const user = await User.findById(req.session.user);
        if (!user || user.isBlocked) {
            console.log("User is blocked or not found.");
          return  req.session.destroy((err) => {
                if (err) {
                    console.error("Error destroying session:", err);
                    return res.status(500).send("Session Error");
                }
                return res.redirect("/login");
            });
        } else {
           return next();
        }
    } catch (error) {
        console.error("Error in userAuth middleware:", error);
        res.status(500).send("Internal Server Error");
    }
};







const adminAuth = async (req, res, next) => {
    try {
        console.log("Admin session value:", req.session.admin);
        
        if (!req.session.admin) {
            console.log("No admin session found.");
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized. Please log in again.',
                });
            }
            return res.redirect("/admin/login");
        }

        // If admin is storing as boolean true, convert it to find admin user
        if (typeof req.session.admin === 'boolean') {
            const adminUser = await User.findOne({ isAdmin: true });
            if (adminUser) {
                req.session.admin = adminUser._id.toString();
            } else {
                if (req.xhr || req.headers.accept.includes('application/json')) {
                    return res.status(401).json({
                        success: false,
                        message: 'No admin user found. Please log in again.',
                    });
                }
                return res.redirect("/admin/login");
            }
        }

        const admin = await User.findById(req.session.admin);
        if (!admin || !admin.isAdmin) {
            console.log("Admin not found or unauthorized.");
            req.session.destroy((err) => {
                if (err) console.error("Error destroying session:", err);
                return res.redirect("/admin/login");
            });
        } else {
            next();
        }
    } catch (error) {
        console.error("Error in adminAuth middleware:", error);
        res.status(500).send("Internal Server Error");
    }
};


module.exports = {
    userAuth,
    adminAuth,
};










