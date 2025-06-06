const mongoose=require("mongoose")
const{Schema}=mongoose;
const couponSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    expiryOn:{
        type:Date,
        required:true
    },
    discountAmount:{
        type:Number,
        required:true
    },
    minimumPrice:{
        type:Number,
        required:true
    },
    maxUsage: {
        type: Number,
        required: true
    },
    isList:{
        type:Boolean,
        default:true
    },
    usedCount: {
        type: Number,
        default: 0,
    },
    userId:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    }]    
})
const Coupon=mongoose.model("Coupon",couponSchema)
module.exports=Coupon




