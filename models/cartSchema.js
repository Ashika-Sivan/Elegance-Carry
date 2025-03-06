
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Define schema for individual cart items
const cartItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 3, 
    },
    price: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      default: "placed",
    },
    cancellationReason: {
      type: String,
      default: "none",
    },
  },
  { timestamps: true } 
);

// Define schema for the entire cart
const cartSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [cartItemSchema], // Array of cart items
  },
  { timestamps: true }  
);

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;



// const mongoose =require("mongoose")
// const {Schema}=mongoose;


// const cartSchema=new Schema({
//     userId:{
//         type:Schema.Types.ObjectId,
//         ref:"User",
//         required:true
//     },
//     items:[{
//         productId:{
//             type:Schema.Types.ObjectId,
//             ref:'Product',
//             required:true
//         },
//         quantity:{
//             type:Number,
//             default:1
//         },
//         price:{
//             type:Number,
//             required:true

//         },
//         totalPrice:{
//             type:Number,
//             required:true
//         },
//         status:{
//             type:String,
//             default:"placed",
//         },
//         cancellationReason:{
//             type:String,
//             default:"none"
//         }
        

//     }]
// })
// const Cart=mongoose.model("Cart",cartSchema);
// module.exports=Cart;