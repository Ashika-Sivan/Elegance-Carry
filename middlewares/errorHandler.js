

// /errorHandlingg middleware
module.exports = function errorHandler(err, req, res, next) {
    // console.error("errorHandler -------------------------",err.stack);
    res.status(500).render('pageerror', { error: err.message });
};