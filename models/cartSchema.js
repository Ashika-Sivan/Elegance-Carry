
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Define schema for individual cart items
const cartItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,//store prduct unique id
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      // max: 3, 
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

//shw shpping crt of user
const cartSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,//who own cart
      ref: "User",
      required: true,
    },
    items: [cartItemSchema], // Array of object cart items
  },
  { timestamps: true }  
);

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;



