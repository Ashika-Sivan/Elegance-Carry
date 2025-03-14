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
const Wallet=require("../../models/walletSchema")
const path = require("path");
const mongoose = require("mongoose");
const Coupon=require("../../models/couponSchema")
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { walletRefund } = require("./walletController");
const { deductWalletBalance } = require("./walletController");
const PDFDocument = require('pdfkit');
const { ObjectId } = require('mongodb');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });


  const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { selectedAddress, paymentMethod, couponId } = req.body;

        // Log request body and session
        console.log("Request Body:", req.body);
        console.log("Session Applied Coupon:", req.session.appliedCoupon);

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

        // Calculate total amount (after sale price discounts)
        const totalAmount = cart.items.reduce((total, item) => {
            if (!item.productId) return total;
            const price = item.productId.salePrice || item.productId.regularPrice;
            return total + price * item.quantity;
        }, 0);

        const discount = cart.items.reduce((total, item) => {
            if (!item.productId) return total;
            const regularPrice = item.productId.regularPrice || 0;
            const salePrice = item.productId.salePrice || regularPrice;
            return total + (regularPrice - salePrice) * item.quantity;
        }, 0);

        const selectedAddressData = addressData.address[0];
        let couponDiscount = 0;
        let appliedCouponCode = null;

        // Apply coupon
        let couponSource = couponId || (req.session.appliedCoupon ? req.session.appliedCoupon.couponId : null);
        console.log("Coupon Source:", couponSource);

        if (couponSource) {
            const coupon = await Coupon.findOne({
                _id: couponSource,
                expiryOn: { $gte: new Date() },
                isList: true,
                $expr: { $lt: ["$usedCount", "$maxUsage"] },
                userId: { $ne: userId },
            });

            if (coupon) {
                console.log("Coupon Found:", coupon);
                if (totalAmount >= coupon.minimumPrice) {
                    couponDiscount = coupon.discountAmount;
                    appliedCouponCode = coupon.name;
                    await Coupon.updateOne(
                        { _id: coupon._id },
                        {
                            $inc: { usedCount: 1 },
                            $push: { userId: userId },
                        }
                    );
                    console.log("Coupon Applied Successfully:", {
                        couponDiscount,
                        appliedCouponCode,
                    });

                    // Clear session coupon after applying to prevent reuse
                    req.session.appliedCoupon = null;
                } else {
                    console.log("Coupon not applied: Total amount below minimum price", {
                        totalAmount,
                        minimumPrice: coupon.minimumPrice,
                    });
                }
            } else {
                console.log("Coupon not found or invalid with conditions:", {
                    couponSource,
                    expiryOn: new Date(),
                    userId,
                });
            }
        } else {
            console.log("No coupon source provided");
        }

        const deliveryCharge = 100;
        const finalAmount = Math.max(totalAmount + deliveryCharge - couponDiscount, 0);

        // Log all amounts for verification
        console.log("Total Amount (before discounts):", totalAmount);
        console.log("Sale Discount:", discount);
        console.log("Coupon Discount:", couponDiscount);
        console.log("Delivery Charge:", deliveryCharge);
        console.log("Final Amount (sent to Razorpay):", finalAmount);

        if (paymentMethod === "COD" && finalAmount > 1000) {
            return res.status(400).json({
                success: false,
                message: "COD is only applicable for orders below 1000 rs. Please choose another payment method.",
            });
        }

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
            couponCode: appliedCouponCode || null,
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
                    message: error.message || "Insufficient wallet balance",
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
                amount: Math.round(finalAmount * 100),
                currency: "INR",
                receipt: savedOrder._id.toString(),
                notes: { orderId: orderId },
            });

            savedOrder.razorpayOrderId = razorpayOrder.id;
            await savedOrder.save();

            console.log("Razorpay Order Created:", razorpayOrder);

            return res.status(200).json({
                success: true,
                message: "Razorpay order created",
                orderId: savedOrder._id,
                razorpayOrderId: razorpayOrder.id,
                amount: Math.round(finalAmount * 100),
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



const verifyPayment = async (req, res) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;
        const userId = req.session.user;

        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ success: false, message: "Server configuration error: Razorpay secret key missing" });
        }

        const generatedSignature = crypto//doing the razorpay process by using sha26
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpayOrderId + "|" + razorpayPaymentId)
            .digest('hex');

        if (generatedSignature === razorpaySignature) {
            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            order.paymentStatus = 'Paid';
            order.razorpayOrderId = razorpayOrderId;
            order.paymentId = razorpayPaymentId;
            order.paymentSignature = razorpaySignature;
            order.status = 'Processing';
            
            await order.save();
            await Cart.findOneAndDelete({ userId });
            res.json({ success: true, message: "Payment verified successfully" });
        } else {
            res.status(400).json({ success: false, message: "Invalid payment signature" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Payment verification failed" });
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
        res.status(500).render("errorPage", { message: "Failed to load orders." });
        
    }
    
}


const cancelOrder = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const userId = req.session.user;

        console.log(`Starting cancellation process - Order: ${orderId}, Item: ${itemId}`);

        const order = await Order.findOne({
            orderId: orderId,
            user: userId,
        }).populate('orderedItems.product');

        if (!order) {
            console.log("Order not found:", orderId);
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        console.log("Initial order state:", {
            orderId: order.orderId,
            orderTotal: order.finalAmount,
            itemsCount: order.orderedItems.length,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus
        });

        const itemIndex = order.orderedItems.findIndex(
            (item) => item._id.toString() === itemId
        );

        if (itemIndex === -1) {
            console.log("Item not found in order:", itemId);
            return res.status(404).json({
                success: false,
                message: "Item not found in order",
            });
        }

        const item = order.orderedItems[itemIndex];
        console.log("Item to cancel:", {
            itemId: item._id,
            price: item.price,
            quantity: item.quantity,
            currentStatus: item.status
        });

        const cancellableStatuses = ["Pending", "Processing"];
        if (!cancellableStatuses.includes(item.status)) {
            console.log(`Cannot cancel item. Current status: ${item.status}`);
            return res.status(400).json({
                success: false,
                message: `Cannot cancel item. Current status: ${item.status}. Cancellation only allowed for Pending or Processing items.`,
            });
        }

        const cancelledItemAmount = item.price * item.quantity;
        console.log(`Amount to be refunded: ${cancelledItemAmount}`);

        const originalFinalAmount = order.finalAmount;
        item.status = "Cancelled";
        order.orderedItems[itemIndex] = item;

        const remainingActiveItems = order.orderedItems.filter(
            orderItem => orderItem.status !== "Cancelled"
        ).length;

        console.log(`Remaining active items after cancellation: ${remainingActiveItems}`);

        let refundAmount = cancelledItemAmount;
        if (remainingActiveItems > 0) {
            order.finalAmount = originalFinalAmount - cancelledItemAmount;
            console.log(`Partial cancellation - New order total: ${order.finalAmount}`);
        } else {
            refundAmount = originalFinalAmount; // Refund full amount for full cancellation
            order.status = "Cancelled";
            console.log(`Full cancellation - Refund amount: ${refundAmount}`);
        }

        if (
            (order.paymentMethod === "Razorpay" && 
             (order.paymentStatus === "Completed" || order.paymentStatus === "Paid")) ||
            order.paymentMethod === "Wallet"
        ) {
            console.log(`Processing refund of ${refundAmount} to wallet`);
            try {
                const refundResult = await walletRefund(
                    userId,
                    refundAmount,
                    order.orderId
                );
                console.log("Refund successful:", refundResult);
            } catch (refundError) {
                console.error("Refund failed:", refundError);
                return res.status(500).json({
                    success: false,
                    message: "Failed to process refund for item",
                    error: refundError.message,
                });
            }
        } else if (order.paymentMethod === "COD") {
            console.log(`No refund processed for COD payment - Order ${order.orderId}`);
        } else {
            console.log(`No refund processed - Payment method: ${order.paymentMethod}, Status: ${order.paymentStatus}`);
        }

        const savedOrder = await order.save();
        console.log("Order updated successfully:", {
            orderId: savedOrder.orderId,
            newTotal: savedOrder.finalAmount,
            status: savedOrder.status
        });

        return res.status(200).json({
            success: true,
            message: "Item cancelled successfully",
            refundAmount: refundAmount,
            newOrderTotal: order.finalAmount
        });
    } catch (error) {
        console.error("Order item cancellation error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during item cancellation",
            error: error.message,
        });
    }
};

const returnOrder = async (req, res) => {
    try {
        const { orderId, itemId } = req.params;
        const { reason, comments } = req.body;
        const userId = req.session.user;
        
        if (!orderId || !itemId) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID or item ID",
            });
        }
        
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
        
        // Find the specific item in orderedItems
        const itemIndex = order.orderedItems.findIndex(
            (item) => item._id.toString() === itemId
        );
        
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Item not found in order",
            });
        }
        
        const item = order.orderedItems[itemIndex];
        
        // Check if the item can be returned
        if (item.status !== "Delivered") {
            return res.status(400).json({
                success: false,
                message: "Only delivered items can be returned",
            });
        }
        
        // Update item status to "Return Requested"
        item.status = "Return Request";
        item.returnReason = reason;
        item.returnComments = comments;
        item.returnRequestDate = new Date();
        
        order.orderedItems[itemIndex] = item;
        
        // Save the updated order
        await order.save();
        
        return res.status(200).json({
            success: true,
            message: "Return request submitted successfully",
        });
    } catch (error) {
        console.error("Return item error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during item return",
            error: error.message,
        });
    }
};

const loadViewDetailsPage = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        const order = await Order.findById(orderId)
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage price salePrice regularPrice'
            });

        if (!order) {
            return res.status(404).render('errorPage', {
                message: 'Order not found'
            });
        }

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
        console.log("Session set:", req.session.appliedCoupon); // Debug log

        // Optionally update coupon usage (if you want to enforce it at apply time)
        // await Coupon.updateOne(
        //     { _id: coupon._id },
        //     { $inc: { usedCount: 1 }, $push: { userId: userId } }
        // );

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

const generateInvoicePDF = (order, res) => {
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('Elegane Carry', { align: 'center' });
    doc.fontSize(14).text('Tax Invoice/Bill of Supply', { align: 'center' });
    doc.moveDown();

    // Invoice Details
    doc.fontSize(12).text(`Invoice Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: 'left' });
    doc.text(`Order ID: ${order.orderId}`, { align: 'left' });
    doc.moveDown();

    // Billing Address
    doc.fontSize(14).text('BILLING ADDRESS:', { underline: true });
    doc.fontSize(12)
       .text(`${order.address.name}`)
       .text(`${order.address.addressType}, ${order.address.city}`)
       .text(`POST - ${order.address.landMark}`)
       .text(`${order.address.state} - ${order.address.pincode}`)
       .text(`PHONE: ${order.address.phone}`);
    doc.moveDown();

    // Order Items Table
    doc.fontSize(14).text('Order Items:', { underline: true });
    doc.moveDown(0.5);

    // Table Headers
    doc.fontSize(12)
       .text('Item', 50, doc.y, { width: 200, align: 'left' })
       .text('Qty', 250, doc.y - 15, { width: 50, align: 'center' })
       .text('Price', 300, doc.y - 15, { width: 100, align: 'right' })
       .text('Total', 400, doc.y - 15, { width: 100, align: 'right' });
    doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown(0.5);

    // Table Rows (Order Items)
    order.orderedItems.forEach(item => {
        const total = item.price * item.quantity;
        doc.text(item.product.productName, 50, doc.y, { width: 200, align: 'left' })
           .text(item.quantity.toString(), 250, doc.y, { width: 50, align: 'center' })
           .text(`₹${item.price}`, 300, doc.y, { width: 100, align: 'right' })
           .text(`₹${total}`, 400, doc.y, { width: 100, align: 'right' });
        doc.moveDown(0.5);
    });

    // Table Footer Line
    doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();
    doc.moveDown();

    // Price Breakdown
    doc.text(`Subtotal: ₹${order.subTotal}`, 400, doc.y, { width: 100, align: 'right' });
    doc.text(`Shipping: ₹${order.deliveryCharge || 100}`, 400, doc.y, { width: 100, align: 'right' }); // Assuming delivery charge is 100 as per the image
    doc.fontSize(14).text(`TOTAL AMOUNT: ₹${order.finalAmount}`, 400, doc.y, { width: 100, align: 'right' });

    doc.end();
};

const downloadInvoice=async(req,res)=>{
    try {
        const orderId=req.params.id;
        const order=await Order.findById(orderId)
            .populate({
                path:'orderedItems.product',
                select:'productName productImage price'
            })

            if(!order){
                return res.status(404).render('pageerror',{
                    messsage:'Order not found'
                })
            }
        if(order.user.toString()!==req.session.user){
            return res.status(403).render('pageerror',{
                message:'unAuthorised access'
            })
        }
        generateInvoicePDF(order,res)

    } catch (error) {
        console.error('Error in downloadInvoice:', error);
        res.status(500).render('pageerror', {
            message: 'Internal server error'
        });
    }
        
}
const retryPayment = async (req, res) => {
    try {
        console.log("Received retryPayment request:", req.body);
        const { orderId, razorpayOrderId } = req.body; // Ignore amount from frontend
        const userId = req.session.user;

        console.log("User ID from session:", userId);
        if (!userId) {
            console.log("Unauthorized access: No user ID in session");
            return res.status(401).json({ success: false, message: "Please login to retry payment" });
        }

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            console.log("Invalid orderId format:", orderId);
            return res.status(400).json({ success: false, message: "Invalid order ID" });
        }

        console.log("Fetching order with ID:", orderId);
        const order = await Order.findById(orderId).populate('orderedItems.product');
        if (!order) {
            console.log("Order not found for ID:", orderId);
            return res.status(400).json({ success: false, message: "Order not found" });
        }
        if (order.paymentStatus !== 'Failed' || order.paymentMethod !== 'Razorpay') {
            console.log("Invalid order for retry:", {
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod
            });
            return res.status(400).json({ success: false, message: "Invalid order for retry" });
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.log("Razorpay configuration missing");
            return res.status(500).json({
                success: false,
                message: "Razorpay configuration missing"
            });
        }

        // Recalculate total amount from ordered items
        let totalAmount = order.orderedItems.reduce((sum, item) => {
            const price = item.product.salePrice || item.product.regularPrice || item.price;
            return sum + (price * item.quantity);
        }, 0);

        let couponDiscount = order.couponDiscount || 0;
        let appliedCouponCode = order.couponCode || null;

        // Revalidate coupon if it exists
        if (order.couponId) {
            const coupon = await Coupon.findById(order.couponId);
            if (coupon && coupon.expiryOn >= new Date() && coupon.usedCount < coupon.maxUsage) {
                if (!coupon.userId || !coupon.userId.includes(userId)) {
                    couponDiscount = coupon.discountAmount;
                    appliedCouponCode = coupon.name;
                    // Note: We won't increment usedCount here since it was already incremented during placeOrder
                } else {
                    console.log("User has already used this coupon during retry:", userId);
                    couponDiscount = 0; // Reset if already used
                }
            } else {
                console.log("Coupon invalid or expired during retry:", order.couponId);
                couponDiscount = 0; // Reset if invalid
            }
        }

        const deliveryCharge = 100; // Assuming fixed delivery charge
        const finalAmount = Math.max(totalAmount + deliveryCharge - couponDiscount, 0);

        console.log("Recalculated Amounts:", {
            totalAmount,
            couponDiscount,
            deliveryCharge,
            finalAmount
        });

        const options = {
            amount: Math.round(finalAmount * 100),
            currency: "INR",
            receipt: `retry_${order._id.toString()}`,
            notes: {
                orderId: order._id,
                originalRazorpayOrderId: razorpayOrderId
            }
        };

        const razorpayOrder = await razorpay.orders.create(options);
        console.log("Razorpay order created:", razorpayOrder);

        order.razorpayOrderId = razorpayOrder.id;
        order.couponDiscount = couponDiscount; // Update with recalculated discount
        order.finalAmount = finalAmount; // Update with recalculated amount
        await order.save();

        console.log("Order after save:", order);
        console.log("Sending success response");
        res.json({
            success: true,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            amount: options.amount,
            razorpayOrderId: razorpayOrder.id,
            orderId: order._id
        });
    } catch (error) {
        console.error("Retry Payment Error:", error);
        res.status(500).json({ success: false, message: "Failed to initiate retry payment" });
    }
};
const updateOrderStatusOnFailure = async (req, res) => {
    try {
        const { orderId, razorpayOrderId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        order.paymentStatus = "Failed";
        order.status = "Pending"; // Keep the order status as Pending so it can be retried
        await order.save();

        
        return res.status(200).json({
            success: true,
            message: "Order status updated to Failed",
        });
    } catch (error) {
        console.error("Error updating order status on failure:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update order status",
        });
    }
};

const walletReturnRefund = async (userId, amount, orderId) => {
    try {
        console.log(`Starting wallet return refund - User: ${userId}, Amount: ${amount}, Order: ${orderId}`);

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error(`Invalid user ID: ${userId}`);
        }

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            console.log(`Wallet not found for user ${userId}, creating new wallet`);
            wallet = new Wallet({ userId, balance: 0, walletHistory: [] });
        }

        const oldBalance = wallet.balance;
        wallet.balance += amount;

        console.log(`Wallet update - Old balance: ${oldBalance}, Amount to add: ${amount}, New balance: ${wallet.balance}`);

        const transactionId = uuidv4();
        wallet.walletHistory.push({
            transactionId: transactionId,
            transactionType: 'credit',
            amount: amount,
            date: new Date(),
            description: "Returned",
            orderId: orderId
        });

        const savedWallet = await wallet.save();
        console.log(`Return refund transaction saved - ID: ${transactionId}, New wallet balance: ${savedWallet.balance}`);

        return savedWallet;
    } catch (error) {
        console.error('Error in walletReturnRefund:', error);
        throw new Error(`Failed to process return refund: ${error.message}`);
    }
};

const paymentFailure = async (req, res) => {
    try {
        res.render("orderFailure")
    } catch (error) {
        console.error("order failed failure",error);
    }
};











module.exports = { 
    placeOrder,
    loadOrderListPage,
    cancelOrder,
    loadViewDetailsPage,
    verifyPayment,
    applyCoupon,
    removeCoupon,
    returnOrder,
    downloadInvoice,
    retryPayment,
    updateOrderStatusOnFailure,
    walletReturnRefund,
    paymentFailure


}
    
