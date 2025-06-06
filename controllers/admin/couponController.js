const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
const Brand=require('../../models/brandSchema')
const Coupon=require('../../models/couponSchema')
const mongoose=require('mongoose')
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require("../../enum/messages")



// Option 2: Show only active coupons with proper date handling
const getCouponPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        
        // Set time to end of today to include coupons expiring today
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        const coupons = await Coupon.find({ expiryOn: { $gte: today } })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        console.log("Found coupons:", coupons);

        const count = await Coupon.countDocuments({ expiryOn: { $gte: today } });
        const totalPage = Math.ceil(count / limit);

        return res.render("coupon", {
            coupons: coupons,
            currentPage: page,
            totalPage,
            message: null
        });

    } catch (error) {
        console.error(error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send("server error");
    }
};

const getCouponList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        
        // Set time to end of today to include coupons expiring today
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        const coupons = await Coupon.find({ expiryOn: { $gte: today } })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        console.log("Found coupons:", coupons);

        const count = await Coupon.countDocuments({ expiryOn: { $gte: today } });
        const totalPage = Math.ceil(count / limit);

        return res.render("couponList", {
            coupons: coupons,
            currentPage: page,
            totalPage,
            message: null
        });

    } catch (error) {
        console.error(error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send("server error");
    }
};


const createCoupon = async (req, res) => {
    try {
        const { name, expiryOn, discountAmount, minimumPrice, maxUsage } = req.body;
        const page=parseInt(req.query.page)||1

        const now = new Date();
        const expiry = new Date(expiryOn);
        const discount = parseFloat(discountAmount);
        const minPrice = parseFloat(minimumPrice);

        if (!name || !expiryOn || !discountAmount || !minimumPrice || !maxUsage) {
            const coupons = await Coupon.find({ expiryOn: { $gte: now } })
            const count = await Coupon.countDocuments({ expiryOn: { $gte: now } });
            const totalPage = Math.ceil(count / 5);

            return res.render("coupon", {
                coupons,
                currentPage: 1,
                totalPage,
                message: "All fields are required"
            });
        }

        if (expiry <= now) {
            const coupons = await Coupon.find({ expiryOn: { $gte: now } });
            const count = await Coupon.countDocuments({ expiryOn: { $gte: now } });
            const totalPage = Math.ceil(count / 5);

            return res.render("coupon", {
                coupons,
                currentPage:page,
                totalPage,
                message: "Expiry date must be in the future"
            });
        }

        if (discount >= minPrice) {
            const coupons = await Coupon.find({ expiryOn: { $gte: now } });
            const count = await Coupon.countDocuments({ expiryOn: { $gte: now } });
            const totalPage = Math.ceil(count / 5);

            return res.render("coupon", {
                coupons,
                currentPage:page,
                totalPage,
                message: "Discount must be less than minimum price"
            });
        }

        const existingCoupon = await Coupon.findOne({ name });
        if (existingCoupon) {
            const coupons = await Coupon.find({ expiryOn: { $gte: now } });
            const count = await Coupon.countDocuments({ expiryOn: { $gte: now } });
            const totalPage = Math.ceil(count / 5);

            return res.render("coupon", {
                coupons,
                currentPage:page,
                totalPage,
                message: "Coupon with this name already exists"
            });
        }

        const newCoupon = new Coupon({
            name,
            expiryOn: expiry,
            discountAmount: discount,
            minimumPrice: minPrice,
            maxUsage,
            usedCount: 0,
            isList: true
        });

        await newCoupon.save();

        const coupons = await Coupon.find({ expiryOn: { $gte: now } });
        const count = await Coupon.countDocuments({ expiryOn: { $gte: now } });
        const totalPage = Math.ceil(count / 5);

        return res.render("coupon", {
            coupons,
            currentPage:page,
            totalPage,
            message: Messages.COUPON_SUCCESS
        });

    } catch (error) {
        console.error("Error creating coupon:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send("Server error while creating coupon");
    }
};



const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.couponId;
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            const coupons = await Coupon.find({ expiryOn: { $gte: new Date() } });
            const count = await Coupon.countDocuments({ expiryOn: { $gte: new Date() } });
            const totalPage = Math.ceil(count / 5); 

            return res.render("couponList", {
                coupons: coupons,
                currentPage: 1,
                totalPage: totalPage,  
                message: "Invalid coupon ID"
            });
        }

      
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            const coupons = await Coupon.find({ expiryOn: { $gte: new Date() } });

            
            const count = await Coupon.countDocuments({ expiryOn: { $gte: new Date() } });
            const totalPage = Math.ceil(count / 5);  

            return res.render("couponList", {
                coupons: coupons,
                currentPage: 1,
                totalPage: totalPage, 
                message: Messages.COUPON_NOT_FOUND
            });
        }

        if (coupon.usedCount > 0) {
            const coupons = await Coupon.find({ expiryOn: { $gte: new Date() } });

            const count = await Coupon.countDocuments({ expiryOn: { $gte: new Date() } });
            const totalPage = Math.ceil(count / 5);  

            return res.render("couponList", {
                coupons: coupons,
                currentPage: 1,
                totalPage: totalPage, 
                message: "Cannot delete coupon that has already been used"
            });
        }

        await Coupon.findByIdAndDelete(couponId);

      
        const coupons = await Coupon.find({ expiryOn: { $gte: new Date() } });
        const count = await Coupon.countDocuments({ expiryOn: { $gte: new Date() } });
        const totalPage = Math.ceil(count / 5);  

        return res.render("couponList", {
            coupons: coupons,
            currentPage: 1,
            totalPage: totalPage,  
            message: 'Coupon deleted successfully'
        });
    } catch (error) {
        console.error("Error deleting coupon:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(Messages.INTERNAL_SERVER_ERROR);
    }
};



module.exports={
    getCouponPage,
    createCoupon,
    deleteCoupon,
    getCouponList

}