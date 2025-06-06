const mongoose=require("mongoose");
const {Schema}=mongoose;

const userSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
    },
    phone:{
        type:String,
        required:false,
        sparse:true,
        default:null
    },
    googleId: {
        type: String,
        sparse: true, 
    },
    addresses: [{
        type: Schema.Types.ObjectId,
        ref: 'Address'
    }],
    password:{
        type:String,
        required:false

    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },
    cart:[{
        type:Schema.Types.ObjectId,
        ref:'Cart'
    }],
    wallet:{
        type:Number,
        default:0,
    },
    WishList:[{
        type:Schema.Types.ObjectId,
        ref:'WishList'
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:'Order'
    }],
    createdOn:{
        type:Date,
        default:Date.now,
    },
    referalCode:{
        type:String,
        // required:true
    },
    redeemed:{
        type:Boolean,
        // default:false
    },
    redeemedUsers:[{//whoever redeemed the refferal code
        type:Schema.Types.ObjectId,
        ref:'User',
        // required:true

    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:'Category'
        },
        brand:{
            type:Schema.Types.ObjectId,
            ref:'Brand'
        },
        searchOn:{
            type:Date,
            default:Date.now
        }
    }]
})




module.exports=mongoose.model("User",userSchema) ;