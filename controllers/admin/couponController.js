const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
const Brand=require('../../models/brandSchema')
const Coupon=require('../../models/couponSchema')
const mongoose=require('mongoose')

const getCouponPage=async(req,res)=>{
    try {
        const page=parseInt(req.query.page)||1
        const coupons=await Coupon.find({expiryOn:{$gte:new Date()}});
        console.log("Found coupons:", coupons); 

        
        return res.render("coupon",{coupons:coupons,currentPage:page,message:null})
       
        
    } catch (error) {
        console.error(error);
        
        res.status(500).send("server error")
        
    }
}


const createCoupon=async(req,res)=>{
    try {
        const {name,expiryOn,discountAmount,minimumPrice,maxUsage}=req.body;
        if(!name||!expiryOn||!discountAmount||!minimumPrice||!maxUsage){
            const coupons=await Coupon.find({expiryOn:{$gte:new Date()}})
            return res.render("coupon",{
                coupons:coupons,
                currentPage:1,
                message:"All fields are required"
            })
        }
        const existingCoupon=await Coupon.findOne({name:name})
        if(existingCoupon){
            const coupons=await Coupon.find({expiryOn:{$gte:new Date()}})
            return res.render("coupon",{
                coupons:coupons,
                currentPage:1,
                message:"coupon with this name already exists"

            })
        }
        const newCoupon=new Coupon({
            name:name,
            expiryOn:new Date(expiryOn),
            discountAmount:discountAmount,
            minimumPrice:minimumPrice,
            maxUsage:maxUsage,
            usedCount:0,
            isList:true
        })
        console.log(newCoupon);
        
        await newCoupon.save()
        
        const coupons=await Coupon.find({expiryOn:{$gte:new Date()}});
        console.log(coupons);
        
        return res.render("coupon",{
            coupons:coupons,
            currentPage:1,
            message:'Coupon added successfully'
        })
    } catch (error) {
        console.error("Error creating coupon:", error);
        res.status(500).send("Server error while creating coupon");
        
    }
}





const deleteCoupon=async(req,res)=>{
    try {
        const couponId=req.params.couponId
        if (!mongoose.Types.ObjectId.isValid(couponId)) {
            const coupons = await Coupon.find({ expiryOn: { $gte: new Date() } });
            return res.render("coupon", {
                coupons: coupons,
                currentPage: 1,
                message: "Invalid coupon ID"
            });
        }
        const coupon=await Coupon.findById(couponId)
        if(!coupon){
        const coupons=await Coupon.find({expiryOn:{$gte:new Date()}});
            return res.render("coupon",{
                coupons:coupons,
                currentPage:1,
                message:'coupon not found'
            })
        }

        if(coupon.usedCount>0){
            const coupons=await Coupon.find({expiryOn:{$gte:new Date()}})
            return res.render("coupon",{
                coupons:coupons,
                currentPage:1,
                message:"Cannot delete coupon that has already been used"
            })
        }
        await Coupon.findByIdAndDelete(couponId)
        const coupons=await Coupon.find({expiryOn:{$gte:new Date()}})
        return res.render("coupon",{
            coupons:coupons,
            currentPage:1,
            message:'coupon deleted successfully'
        })
    } catch (error) {
        console.error("Error deleting coupon:", error);
        res.status(500).send("Server error while deleting coupon");
        
    }
}



module.exports={
    getCouponPage,
    createCoupon,
  
    deleteCoupon

}