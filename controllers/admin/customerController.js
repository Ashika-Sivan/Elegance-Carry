const User = require("../../models/userSchema")
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require("../../enum/messages");


const customerInfo = async (req, res) => {
    try {
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;
        const query = { isAdmin: false };
        
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: { $regex: searchRegex } },
                { email: { $regex: searchRegex } },
                { phone: { $regex: searchRegex } } 
            ];
        }

       
        const userData = await User.find(query)
            .limit(limit)
            .skip(skip)
            .exec();

        const count = await User.countDocuments(query);
        const totalPages = Math.ceil(count / limit);

        res.render("customers", {
            data: userData,
            totalPages,
            currentPage: page, 
            searchQuery: search, 
            searchTerm: search, 
            query: req.query 
        });

    } catch (error) {
        console.log("customerInfo error:", error);
        res.redirect("/pageerror");
    }
};

const customerBlocked = async (req, res) => {
    try {
        let id = req.body.id; 
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.status(HttpStatus.OK).json({ success: true });
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: Messages.INTERNAL_SERVER_ERROR});
    }
};

const customerUnBlocked = async (req, res) => {
    try {
        let id = req.body.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.status(HttpStatus.OK).json({ success: true });
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: Messages.INTERNAL_SERVER_ERROR });
    }
};



module.exports = {
    customerInfo,
    customerBlocked,
    customerUnBlocked,
}