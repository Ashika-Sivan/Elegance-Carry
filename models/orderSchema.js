const mongoose=require("mongoose")
const { v4: uuidv4 } = require('uuid');
const {Schema}=mongoose

const orderSchema = new Schema(
    {
      orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true,
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      address: {
        addressType: {
          type: String,
          required: true,
          enum: ['home', 'office', 'other']
        },
        name: {
          type: String,
          required: true,
        },
        city: {
          type: String,
          required: true,
        },
        landMark: {
          type: String,
          required: true,
        },
        state: {
          type: String,
          required: true,
          enum: [
            'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
            'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
            'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
            'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
            'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
            'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep', 'Delhi',
            'Puducherry'
          ],
        },
        pincode: {
          type: Number,
          required: true,
        },
        phone: {
          type: String,
          required: true,
        },
        altPhone: {
          type: String,
          required: true,
        },
      },
      orderedItems: [
        {
          product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true,
          },
          quantity: {
            type: Number,
            required: true,
          },
          price: {
            type: Number,
            default: 0,
          },
          status: {  // New field for individual item status
            type: String,
            default: "Processing",
            enum: [
              "Pending",
              "Processing",
              "Shipped",
              "Delivered",
              "Cancelled",
              "Return Request",
              "Returned",
            ],
          },
        },
      ],
  
      categoryId: {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
      paymentMethod: {
        type: String,
        enum: ["COD", "Razorpay", "Paypal", "Wallet"],
        required: true,
      },
      paymentStatus: {
        type: String,
        enum: ["Pending", "Completed", "Failed", "Paid"],
        default: "Pending",
      },
  
      subTotal: {
        type: Number,
        required: true,
      },
      totalPrice: {
        type: Number,
        required: true,
      },
      discount: {
        type: Number,
        default: 0,
      },
      finalAmount: {
        type: Number,
        required: true,
      },
      deliveryCharge: {
        type: Number,
        required: false,
      },
      deliveryMethod: {
        type: String,
        required: false,
      },
      invoiceDate: {
        type: Date,
      },
      status: {
        type: String,
        required: true,
        enum: [
          "Pending",
          "Processing",
          "Shipped",
          "Delivered",
          "Cancelled",
          "Return Request",
          "Returned",
        ],
      },
      couponApplied: {
        type: Boolean,
        default: false,
      },
      couponDiscount: {
        type: Number,
        default: null,
      },
      couponCode: {
        type: String,
        default: null,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      deliveryDate: {
        type: Date,
      },
      razorpayOrderId: {
        type: String,
        default: ""
    },
    paymentId: {
        type: String,
        default: ""
    },
    paymentSignature: {
        type: String,
        default: ""
    },
    returnReason: {
            type: String,
            default: null,
        },
        returnComments: {
            type: String,
            default: null,
        },
        returnRequestDate: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
  );

const Order=mongoose.model("Order",orderSchema)
module.exports=Order














