const { unblock } = require("sharp");
const Brand=require("../../models/brandSchema")
const product=require("../../models/productSchema")


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
        res.redirect("/pageerror")
        
    }
};

const addBrand = async (req, res) => {
    try {
        const brandName = req.body.name; // Ensure this matches the schema
        const existingBrand = await Brand.findOne({ name: brandName });
        
        if (!existingBrand) {

            // const image = req.file ? req.file.filename : null; // Ensure file upload is handled
            
            // if (!image) {
            //     return res.status(400).send("Brand image is required.");
            // }

            const newBrand = new Brand({
                name: brandName,
                // brandImage: [image], // Ensure this matches the schema type
            });

            await newBrand.save();
            res.redirect("/admin/brands");
        } else {
            res.status(400).send("Brand already exists.");
        }
    } catch (error) {
        console.error("Error adding brand:", error);
        res.redirect("/pageerror");
    }
};


const blockBrand = async (req, res) => {
    try {
        const id = req.body.id; // Changed from req.query to req.body
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

const unBlockBrand = async (req, res) => {
    try {
        const id = req.body.id; // Changed from req.query to req.body
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};



module.exports={
    getBrandPage,
    addBrand,
    blockBrand,
    unBlockBrand,
    
}

