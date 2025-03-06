const User = require("../../models/userSchema")


const customerInfo = async (req, res) => {
    try {

        let search = "";
        if (req.query.search) {//if the frontend's name field has the options to search and access to backend
            search = req.query.search;
        }
        //pagination it is from backend
        let page = 1;
        if (req.query.page) {
            page = req.query.page
        }
        const limit = 8
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*" } },//to find the starting and ending of the name
                { email: { $regex: ".*" + search + ".*" } },
            ],

        })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec()


        const count = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*" } },
                { email: { $regex: ".*" + search + ".*" } },
            ],

        }).countDocuments();

        const totalPages = Math.ceil(count / limit)



        res.render("customers", {
            data: userData,
            totalPages,
            currentPage: 'users',
            searchTerm: search
        })
    } catch (error) {
        res.redirect("/pageerror")
    }
}


const customerBlocked = async (req, res) => {
    try {
        let id = req.body.id; 
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

const customerUnBlocked = async (req, res) => {
    try {
        let id = req.body.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};



module.exports = {
    customerInfo,
    customerBlocked,
    customerUnBlocked,
}