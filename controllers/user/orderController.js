const User = require("../../models/userSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
const { v4: uuidv4 } = require('uuid');
const session = require("express-session");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const Cart = require("../../models/cartSchema");
const Category = require("../../models/categorySchema");
const Order = require("../../models/orderSchema");
const path = require("path");
const mongoose = require("mongoose");
const Coupon=require("../../models/couponSchema")
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { walletRefund } = require("./walletController");
const { deductWalletBalance } = require("./walletController");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

// const placeOrder = async (req, res) => {
//     try {
//         const userId = req.session.user;
//         const { selectedAddress, paymentMethod,couponCode } = req.body;

//         // Find cart and populate product details
//         const cart = await Cart.findOne({ userId }).populate("items.productId");
        
//         if (!cart || cart.items.length === 0) {
//             return res.status(400).json({ 
//                 success: false, 
//                 message: "Cart is empty" 
//             });
//         }

//         // Validate address
//         const addressData = await Address.findOne(
//             { userId, "address._id": selectedAddress },
//             { "address.$": 1 }
//         );

//         if (!addressData || !addressData.address || addressData.address.length === 0) {
//             return res.status(400).json({ 
//                 success: false,
//                 message: "Selected address not found" 
//             });
//         }
        
//         let couponDiscount=0

//         // const discount=regularPrice-salePrice

//         const discount = cart.items.reduce((total, item) => {
//             if(!item.productId)return total;
//             const regularPrice=item.productId.regularPrice||0;
//             const salePrice=item.productId.salePrice||regularPrice;
//             return total + ((regularPrice - salePrice) * item.quantity);
//         }, 0);
        
//         const selectedAddressData = addressData.address[0];
//         const totalAmount = cart.items.reduce((total, item) => {
//             return total + item.totalPrice;
//         }, 0);


//         if(couponCode){
//             const coupon=await Coupon.findOne({
//                 name:couponCode,
//                 expiryOn:{$gte:new Date()},
//                 isList:true,
//                 $expr:{$lt:["$usedCount","$maxUsage"]},
//                 userId:{$ne:userId}
//             })

//             if(coupon && totalAmount >=coupon.minimumPrice){
//                 couponDiscount=coupon.discountAmount;
//                 await Coupon.updateOne(
//                     {_id:coupon._id},
//                     {
//                         $inc:{usedCount:1},
//                         $push:{userId:userId}
//                     }

//                 )
//             }

//         }
//         const deliveryCharge=100;
//         const finalAmount=Math.max(totalAmount+deliveryCharge-discount-couponDiscount,0)

//         // Create common order data
//         const orderId = uuidv4();
//         const orderData = {
//             user: userId,
//             orderedItems: cart.items.map(item => ({
//                 product: item.productId._id,
//                 quantity: item.quantity,
//                 price: item.price
//             })),
//             address: {
//                 addressType: selectedAddressData.addressType,
//                 name: selectedAddressData.name,
//                 city: selectedAddressData.city,
//                 landMark: selectedAddressData.landMark,
//                 state: selectedAddressData.state.charAt(0).toUpperCase() + selectedAddressData.state.slice(1),
//                 pincode: selectedAddressData.pincode,
//                 phone: selectedAddressData.phone,
//                 altPhone: selectedAddressData.altPhone
//             },
//             totalPrice: totalAmount,
//             subTotal: totalAmount,
//             discount: discount,
//             couponDiscount:couponDiscount,
//             finalAmount: finalAmount,
//             paymentMethod: paymentMethod,
//             orderId: orderId,
//             couponCode:couponCode||null
//         };

//         // Handle different payment methods
//         if (paymentMethod === "COD") {
//             // For Cash on Delivery
//             orderData.paymentStatus = "Pending";
//             orderData.status = "Processing";
            
//             const newOrder = new Order(orderData);
//             const savedOrder = await newOrder.save();

//             // Update product inventory
//             for (const item of cart.items) {
//                 await Product.updateOne(
//                     { _id: item.productId._id },
//                     { $inc: { quantity: -item.quantity } }
//                 );
//             }

//             // Clear cart
//             await Cart.deleteOne({ userId });

//             return res.status(200).json({
//                 success: true,
//                 message: "COD Order placed successfully",
//                 orderId: savedOrder._id,
//                 order: savedOrder
//             });
//         } 
//         else if (paymentMethod === "Wallet") {
//             // For Wallet Payment
//             // First check if user has sufficient balance
//             const user = await User.findById(userId);
            
//             if (!user || user.walletBalance < finalAmount) {
//                 return res.status(400).json({
//                     success: false,
//                     message: "Insufficient wallet balance"
//                 });
//             }

//             // Deduct amount from wallet
//             user.walletBalance -= finalAmount;
//             await user.save();

//             // Update order status
//             orderData.paymentStatus = "Completed";
//             orderData.status = "Processing";
            
//             const newOrder = new Order(orderData);
//             const savedOrder = await newOrder.save();

//             // Update product inventory
//             for (const item of cart.items) {
//                 await Product.updateOne(
//                     { _id: item.productId._id },
//                     { $inc: { quantity: -item.quantity } }
//                 );
//             }

//             // Clear cart
//             await Cart.deleteOne({ userId });

//             return res.status(200).json({
//                 success: true,
//                 message: "Order placed successfully using Wallet",
//                 orderId: savedOrder._id,
//                 order: savedOrder
//             });
//         }
//         else if (paymentMethod === "Razorpay") {
//             // For Razorpay, create an order in your DB with pending status
//             orderData.paymentStatus = "Pending";
//             orderData.status = "Pending";
            
//             const newOrder = new Order(orderData);
//             const savedOrder = await newOrder.save();

//             // Check if Razorpay credentials are available
//             if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
//                 return res.status(500).json({
//                     success: false,
//                     message: "Razorpay configuration missing"
//                 });
//             }

//             // Initialize Razorpay
//             const razorpay = new Razorpay({
//                 key_id: process.env.RAZORPAY_KEY_ID,
//                 key_secret: process.env.RAZORPAY_KEY_SECRET
//             });

//             // Create Razorpay order
//             const razorpayOrder = await razorpay.orders.create({
//                 amount: Math.round(totalAmount * 100), // Razorpay expects amount in paise
//                 currency: 'INR',
//                 receipt: savedOrder._id.toString(),
//                 notes: {
//                     orderId: orderId
//                 }
//             });

//             // Update order with Razorpay order ID
//             savedOrder.razorpayOrderId = razorpayOrder.id;
//             await savedOrder.save();

//             // Return the required information for the frontend to initiate Razorpay payment
//             return res.status(200).json({
//                 success: true,
//                 message: "Razorpay order created",
//                 orderId: savedOrder._id,
//                 razorpayOrderId: razorpayOrder.id,
//                 amount: Math.round(totalAmount * 100),
//                 razorpayKeyId: process.env.RAZORPAY_KEY_ID
//             });
//         } 
//         else {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid payment method"
//             });
//         }
//     } catch (error) {
//         console.error("Order placement error:", error);
//         return res.status(500).json({
//             success: false,
//             message: error.message || "Error placing order"
//         });
//     }
// };




const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { selectedAddress, paymentMethod, couponCode } = req.body;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    const addressData = await Address.findOne(
      { userId, "address._id": selectedAddress },
      { "address.$": 1 }
    );
    if (!addressData || !addressData.address || addressData.address.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Selected address not found",
      });
    }

    let couponDiscount = 0;
    const discount = cart.items.reduce((total, item) => {
      if (!item.productId) return total;
      const regularPrice = item.productId.regularPrice || 0;
      const salePrice = item.productId.salePrice || regularPrice;
      return total + (regularPrice - salePrice) * item.quantity;
    }, 0);

    const selectedAddressData = addressData.address[0];
    const totalAmount = cart.items.reduce((total, item) => {
      return total + item.totalPrice;
    }, 0);

    if (couponCode) {
      const coupon = await Coupon.findOne({
        name: couponCode,
        expiryOn: { $gte: new Date() },
        isList: true,
        $expr: { $lt: ["$usedCount", "$maxUsage"] },
        userId: { $ne: userId },
      });

      if (coupon && totalAmount >= coupon.minimumPrice) {
        couponDiscount = coupon.discountAmount;
        await Coupon.updateOne(
          { _id: coupon._id },
          {
            $inc: { usedCount: 1 },
            $push: { userId: userId },
          }
        );
      }
    }

    const deliveryCharge = 100;
    const finalAmount = Math.max(totalAmount + deliveryCharge - discount - couponDiscount, 0);

    const orderId = uuidv4();
    const orderData = {
      user: userId,
      orderedItems: cart.items.map((item) => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.price,
      })),
      address: {
        addressType: selectedAddressData.addressType,
        name: selectedAddressData.name,
        city: selectedAddressData.city,
        landMark: selectedAddressData.landMark,
        state: selectedAddressData.state.charAt(0).toUpperCase() + selectedAddressData.state.slice(1),
        pincode: selectedAddressData.pincode,
        phone: selectedAddressData.phone,
        altPhone: selectedAddressData.altPhone,
      },
      totalPrice: totalAmount,
      subTotal: totalAmount,
      discount: discount,
      couponDiscount: couponDiscount,
      finalAmount: finalAmount,
      paymentMethod: paymentMethod,
      orderId: orderId,
      couponCode: couponCode || null,
    };

    if (paymentMethod === "COD") {
      orderData.paymentStatus = "Pending";
      orderData.status = "Processing";
      const newOrder = new Order(orderData);
      const savedOrder = await newOrder.save();

      for (const item of cart.items) {
        await Product.updateOne(
          { _id: item.productId._id },
          { $inc: { quantity: -item.quantity } }
        );
      }

      await Cart.deleteOne({ userId });
      return res.status(200).json({
        success: true,
        message: "COD Order placed successfully",
        orderId: savedOrder._id,
        order: savedOrder,
      });
    } else if (paymentMethod === "Wallet") {
        try {
          // Use deductWalletBalance to subtract money from wallet
          await deductWalletBalance(userId, finalAmount, orderId);
      
          orderData.paymentStatus = "Completed";
          orderData.status = "Processing";
          const newOrder = new Order(orderData);
          const savedOrder = await newOrder.save();
      
          for (const item of cart.items) {
            await Product.updateOne(
              { _id: item.productId._id },
              { $inc: { quantity: -item.quantity } }
            );
          }
      
          await Cart.deleteOne({ userId });
          return res.status(200).json({
            success: true,
            message: "Order placed successfully using Wallet",
            orderId: savedOrder._id,
            order: savedOrder,
          });
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: error.message || "Insufficient wallet balance"
          });
        }
      
    } else if (paymentMethod === "Razorpay") {
      orderData.paymentStatus = "Pending";
      orderData.status = "Pending";
      const newOrder = new Order(orderData);
      const savedOrder = await newOrder.save();

      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return res.status(500).json({
          success: false,
          message: "Razorpay configuration missing",
        });
      }

      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: savedOrder._id.toString(),
        notes: { orderId: orderId },
      });

      savedOrder.razorpayOrderId = razorpayOrder.id;
      await savedOrder.save();

      return res.status(200).json({
        success: true,
        message: "Razorpay order created",
        orderId: savedOrder._id,
        razorpayOrderId: razorpayOrder.id,
        amount: Math.round(totalAmount * 100),
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }
  } catch (error) {
    console.error("Order placement error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error placing order",
    });
  }
};

// Keep other functions (verifyPayment, loadOrderListPage, etc.) unchanged...


const verifyPayment = async (req, res) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        
        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return res.status(400).json({
                success: false,
                message: "Missing payment verification parameters"
            });
        }

        // Verify the payment signature
        const body = razorpayOrderId + "|" + razorpayPaymentId;
        
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");
            
        const isAuthentic = expectedSignature === razorpaySignature;
        
        if (!isAuthentic) {
            return res.status(400).json({
                success: false,
                message: "Payment verification failed"
            });
        }

        // Find the order by Razorpay order ID
        const order = await Order.findOne({ razorpayOrderId });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Update order status and payment details
        order.paymentStatus = "Completed";
        order.status = "Processing"; // Change to your desired status
        order.paymentId = razorpayPaymentId;
        order.paymentSignature = razorpaySignature;
        
        await order.save();

        // Update product inventory (only when payment is verified)
        for (const item of order.orderedItems) {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { quantity: -item.quantity } }
            );
        }

        // Clear cart
        await Cart.deleteOne({ userId: order.user });

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            order: order
        });

    } catch (error) {
        console.error("Payment verification error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error verifying payment"
        });
    }
};

const loadOrderListPage=async(req,res)=>{
    try {
        const userId=req.session.user
        if(!userId){
            return res.redirect("/login");
        }
        const orders=await  Order.find({user:userId})
            .populate({
                path:"orderedItems.product",
                model:"Product",
                select:"productName productImage"
            })
            .sort({createdAt:-1});
            res.render("orderList",{orders})
        
    } catch (error) {
        console.error("Error loading order list page:", error);
        res.status(500).render("errorPage", { message: "Failed to load orders." });
        
    }
    
}

// const cancelOrder=async(req,res)=>{
//     try {
        
//         const orderId=req.params.orderId
//         const userId=req.session.user;

//         const order=await Order.findOne({
//             orderId:orderId,
//             user:userId
//         }).populate('orderedItems.product')

//         if(!order){
//             return res.status(404).json({
//                 success:false,
//                 message:"Order not found"
//             })
//         }
//         if(order.status==='Delivered' || order.status==='Cancelled'){
//             return res.status(400).json({
//                 success:false,
//                 message:`Order cannot be cancelled as it is ${order.status}`
//             })
//         }

//         // Restore the quantity of the product back to inventory
//         for(const item of order.orderedItems){
//             await Product.updateOne(
//                 {_id:item.product._id},
//                 {$inc:{quantity:item.quantity}} // Increment the stock
//             )
//         }

//         // If payment was made through Razorpay or Wallet, refund the amount
//         if (order.paymentMethod === 'Razorpay' && order.paymentStatus === 'Completed') {
          
//             const user = await User.findById(userId);
//             if (user) {
//                 user.walletBalance += order.finalAmount;
//                 await user.save();
//             }
//         } else if (order.paymentMethod === 'Wallet') {
//             // Return money to wallet
//             const user = await User.findById(userId);
//             if (user) {
//                 user.walletBalance += order.finalAmount;
//                 await user.save();
//             }
//         }

//         order.status = 'Cancelled';
//         order.cancellationDate = new Date();
//         await order.save();

//         // If the message response is successful then send back to orders page
//         if(req.xhr || req.headers.accept.indexOf('json') > -1){
//             return res.status(200).json({
//                 success: true,
//                 message: "Order Cancelled successfully"
//             });
//         }
//         res.redirect('/orders');

//     } catch (error) {
//         console.error("Order cancellation error:", error);
//         if (req.xhr || req.headers.accept.indexOf('json') > -1) {
//             return res.status(500).json({
//                 success: false,
//                 message: error.message || "Error cancelling order"
//             });
//         }
//         res.status(500).render("errorPage", {message: "Failed to cancel order"});
//     }
// }

// const cancelOrder = async (req, res) => {
//     try {
//         const orderId = req.params.orderId;
//         const userId = req.session.user;

//         const order = await Order.findOne({
//             orderId: orderId,
//             user: userId,
//         }).populate('orderedItems.product');

//         if (!order) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Order not found",
//             });
//         }
//         if (order.status === 'Delivered' || order.status === 'Cancelled') {
//             return res.status(400).json({
//                 success: false,
//                 message: `Order cannot be cancelled as it is ${order.status}`,
//             });
//         }

//         for (const item of order.orderedItems) {
//             if (!item.product) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'One or more products in the order are not available',
//                 });
//             }
//             await Product.updateOne(
//                 { _id: item.product._id },
//                 { $inc: { quantity: item.quantity } }
//             );
//         }

//         // if (order.paymentMethod === 'Razorpay' && order.paymentStatus === 'Completed'||order.paymentMethod === 'Wallet') {
//         //     await walletRefund(
//         //         userId,
//         //         order.finalAmount,
//         //         `refund for order cancellation-order Id:${order.orderId}`
//         //     )
//         // }else if(privateDecrypt.paymentMethod==='COD'){
//         //     console.log(`No refund processed for COD order ${order.orderId}`);

//         // }else{
//         //     console.log(`No refund processed for payment method ${order.paymentMethod} for order ${order.orderId}`);

//         // }


//         if (order.paymentMethod === 'Razorpay' && order.paymentStatus === 'Completed' || order.paymentMethod === 'Wallet') {
//             await walletRefund(
//                 userId,
//                 order.finalAmount,
//                 order.orderId // Pass the orderId instead of a custom description
//             )
//         } else if (order.paymentMethod === 'COD') {
//             console.log(`No refund processed for COD order ${order.orderId}`);
//         } else {
//             console.log(`No refund processed for payment method ${order.paymentMethod} for order ${order.orderId}`);
//         }


//         order.status = 'Cancelled';
//         order.cancellationDate = new Date();
//         await order.save();

//         // If the message response is successful then send back to orders page
//         if (req.xhr || req.headers.accept.indexOf('json') > -1) {
//             return res.status(200).json({
//                 success: true,
//                 message: "Order Cancelled successfully",
//             });
//         }
//         res.redirect('/orders');
//     } catch (error) {
//         console.error("Order cancellation error:", error);
//         if (req.xhr || req.headers.accept.indexOf('json') > -1) {
//             return res.status(500).json({
//                 success: false,
//                 message: error.message || "Error cancelling order",
//             });
//         }
//         res.status(500).render("errorPage", { message: "Failed to cancel order" });
//     }
// };


const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user;

        const order = await Order.findOne({
            orderId: orderId,
            user: userId,
        }).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }
        if (order.status === 'Delivered' || order.status === 'Cancelled') {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled as it is ${order.status}`,
            });
        }

        // Product inventory restoration logic remains the same

        // Enhanced refund logging
        if (order.paymentMethod === 'Razorpay' && order.paymentStatus === 'Completed' || order.paymentMethod === 'Wallet') {
            try {
                const refundResult = await walletRefund(
                    userId,
                    order.finalAmount,
                    order.orderId
                );
                console.log('Refund successful:', refundResult);
            } catch (refundError) {
                console.error('Refund failed:', refundError);
                // Optionally, you can send a notification or log this error for admin review
                return res.status(500).json({
                    success: false,
                    message: "Failed to process refund",
                    error: refundError.message
                });
            }
        } else if (order.paymentMethod === 'COD') {
            console.log(`No refund processed for COD order ${order.orderId}`);
        } else {
            console.log(`No refund processed for payment method ${order.paymentMethod} for order ${order.orderId}`);
        }

        order.status = 'Cancelled';
        order.cancellationDate = new Date();
        await order.save();

        // Rest of the code remains the same
    } catch (error) {
        console.error("Order cancellation error:", error);
        // Error handling remains the same
    }
};
const returnOrder=async(req,res)=>{
    try {
        const {orderId}=req.params;
        const {reason,comments}=req.body
        
        if (!orderId || typeof orderId !== "string") {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID",
            });
        }
        const order=await Order.findOne({orderId})
        if(!order){
            return res.status(404).json({
                success:false,
                message:"Order not found",
            })
        }
        if(order.status!=="Delivered"){
            return res.status(400).json({
                success:false,
                message:"Only delivered orders can be returned",
            })
        }
        const updatedOrder=await  Order.findOneAndUpdate(
                {orderId},
            {
                status:"Return Request",
                $set:{
                    returnReason:reason,
                    returnComments:comments,
                    returnRequestDate:new Date(),
                }
            },
            {new:true}
        );
        res.json({
            success: true,
            message: "Return request submitted successfully",
            order: updatedOrder,
        });
        
    } catch (error) {
        console.error("Error in returnOrder:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit return request",
            error:error.message,
        });
        
    }
}

const loadViewDetailsPage = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        const order = await Order.findById(orderId)
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage price'
            });

        if (!order) {
            return res.status(404).render('errorPage', {
                message: 'Order not found'
            });
        }

        // Verify the order belongs to the logged-in user
        if (order.user.toString() !== req.session.user) {
            return res.status(403).render('errorPage', {
                message: 'Unauthorized access'
            });
        }

        res.render('viewDetails', {
            order: order
        });

    } catch (error) {
        console.error('Error in loadViewDetailsPage:', error);
        res.status(500).render('errorPage', {
            message: 'Internal server error'
        });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Please log in to apply a coupon" });
        }

        const { couponId } = req.body;
        if (!couponId || !mongoose.Types.ObjectId.isValid(couponId)) {
            return res.status(400).json({ success: false, message: "Invalid coupon ID" });
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        // Check if coupon is expired
        if (coupon.expiryOn < new Date()) {
            return res.status(400).json({ success: false, message: "Coupon has expired" });
        }

        // Check if coupon usage limit has been reached
        if (coupon.usedCount >= coupon.maxUsage) {
            return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
        }

        // Check if the user has already used this coupon
        if (coupon.userId && coupon.userId.includes(userId)) {
            return res.status(400).json({ success: false, message: "You have already used this coupon" });
        }

        // Calculate the cart total
        const cartData = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: "productName productImage regularPrice salePrice quantity discount isBlocked"
            });

        let totalAmount = 0;
        if (cartData && cartData.items) {
            totalAmount = cartData.items.reduce((sum, item) => {
                if (!item.productId || item.productId.isBlocked) return sum;
                const salePrice = item.productId.salePrice || item.productId.regularPrice;
                return sum + (salePrice * item.quantity);
            }, 0);
        }

        // Check if the cart total meets the minimum price requirement
        if (totalAmount < coupon.minimumPrice) {
            return res.status(400).json({ 
                success: false, 
                message: `This coupon requires a minimum purchase of ₹${coupon.minimumPrice}. Your cart total is ₹${totalAmount}.`
            });
        }

        // Apply the coupon by storing it in the session
        req.session.appliedCoupon = {
            couponId: coupon._id,
            discountAmount: coupon.discountAmount
        };

        return res.status(200).json({ 
            success: true, 
            message: "Coupon applied successfully",
            discountAmount: coupon.discountAmount,
            finalAmount: Math.max(totalAmount + 100 - coupon.discountAmount, 0) // Assuming deliveryCharge = 100
        });
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({ success: false, message: "Server error while applying coupon" });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        const cartData = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: "productName productImage regularPrice salePrice quantity discount isBlocked"
            });

        if (!cartData || !cartData.items || cartData.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        let totalAmount = cartData.items.reduce((sum, item) => {
            if (!item.productId || item.productId.isBlocked) return sum;
            const salePrice = item.productId.salePrice || item.productId.regularPrice;
            return sum + (salePrice * item.quantity);
        }, 0);

        const deliveryCharge = 100;
        req.session.appliedCoupon = null; // Clear the applied coupon from session
        const finalAmount = totalAmount + deliveryCharge;

        res.json({
            success: true,
            finalAmount,
            message: "Coupon removed successfully"
        });
    } catch (error) {
        console.error("Error removing coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove coupon"
        });
    }
};


// Export the function if using a modular approach



module.exports = { 
    placeOrder,
    loadOrderListPage,
    cancelOrder,
    loadViewDetailsPage,
    verifyPayment,
    applyCoupon,
    removeCoupon,
    returnOrder
};