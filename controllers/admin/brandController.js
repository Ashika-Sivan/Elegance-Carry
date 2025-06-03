const { unblock } = require("sharp");
const Brand=require("../../models/brandSchema")
const product=require("../../models/productSchema")
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require("../../enum/messages");


const getBrandPage=async(req,res)=>{
    try {
        const page=parseInt(req.query.page)||1
        const limit=6;
        const skip=(page-1)*limit;
        const brandData=await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit);
        const totalBrands=await Brand.countDocuments();
        const totalPages=Math.ceil(totalBrands/limit)
        const reverseBrand=brandData.reverse();
        res.render("brands",{
            data:reverseBrand,
            currentPage:page,
            totalPages:totalPages,
            totalBrands:totalBrands,

        })
        
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).redirect("/pageerror")
        
    }
};

const addBrand = async (req, res) => {
    try {
        const brandName = req.body.name; 
        const existingBrand = await Brand.findOne({ name: brandName });
        
        if (!existingBrand) {
            const newBrand = new Brand({
                name: brandName,
            });

            await newBrand.save();
            res.redirect("/admin/brands");
        } else {
            res.status(HttpStatus.BAD_REQUEST).send("Brand already exists.");
        }
    } catch (error) {
        console.error("Error adding brand:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).redirect("/pageerror");
    }
};


const blockBrand = async (req, res) => {
    try {
        const id = req.body.id; // Changed from req.query to req.body
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.status(HttpStatus.OK).json({ success: true });
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: Messages.INTERNAL_SERVER_ERROR });
    }
};

const unBlockBrand = async (req, res) => {
    try {
        const id = req.body.id; // Changed from req.query to req.body
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.status(HttpStatus.OK).json({ success: true });
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: Messages.INTERNAL_SERVER_ERROR });
    }
};



module.exports={
    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    
}

