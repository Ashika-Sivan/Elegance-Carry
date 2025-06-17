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
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require('../../enum/messages');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });


  const placeOrder = async (req, res) => {          
    try {
        const userId = req.session.user;
        const { selectedAddress, paymentMethod, couponId } = req.body;


        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: Messages.CART_EMPTY
            });
        }

        const blockedProduct=cart.items.find((item)=>item.productId.isBlocked)
        if(blockedProduct){
            return res.status(HttpStatus.BAD_REQUEST).json({success:false,message:`The product "${blockedProduct.productId.name}" is currently unavailable (blocked by admin). Please remove it from your cart to proceed.`,})
        }

        const addressData = await Address.findOne(
            { userId, "address._id": selectedAddress },
            { "address.$": 1 }//return matched address instead of whole address array
        );
        if (!addressData || !addressData.address || addressData.address.length === 0) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: Messages.ADDRESS_NOT_FOUND,
            });
        }
        const totalAmount = cart.items.reduce((total, item) => {
            if (!item.productId) return total;//0
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
        let couponSource = couponId || (req.session.appliedCoupon ? req.session.appliedCoupon.couponId : null);
        

        if (couponSource) {
            const coupon = await Coupon.findOne({
                _id: couponSource,
                expiryOn: { $gte: new Date() },
                isList: true,
                $expr: { $lt: ["$usedCount", "$maxUsage"] },
                userId: { $ne: userId },
            });

            if (coupon) {
                if (totalAmount >= coupon.minimumPrice) {//check the total Amount is greater than minimum Price
                    couponDiscount = coupon.discountAmount;//save the discount amount 
                    appliedCouponCode = coupon.name;//name for later use
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


        if (paymentMethod === "COD" && finalAmount > 1000) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "COD is only applicable for orders below 1000 rs. Please choose another payment method.",
            });
        }
//creatingg order
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
            return res.status(HttpStatus.OK).json({
                success: true,
                message:Messages.COD_ORDER_SUCCESS,
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

                await Cart.deleteOne({ userId });//remove the product fro cart
                return res.status(HttpStatus.OK).json({
                    success: true,
                    message: Messages. WALLET_ORDER_SUCCESS,
                    orderId: savedOrder._id,
                    order: savedOrder,
                });
            } catch (error) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: error.message || Messages.INSUFFICIENT_BALANCE
                });
            }
        } else if (paymentMethod === "Razorpay") {
            orderData.paymentStatus = "Pending";
            orderData.status = "Pending";
            const newOrder = new Order(orderData);
            const savedOrder = await newOrder.save();

            if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) { 
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                    success: false,
                    message:Messages.RAZORPAY_CONFIGURATION
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

            return res.status(HttpStatus.OK).json({
                
                success: true,
                message: Messages.RAZORPAY_ORDER_SUCCESS,
                orderId: savedOrder._id,
                razorpayOrderId: razorpayOrder.id,
                amount: Math.round(finalAmount * 100),
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            });
        } else {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: Messages.invalID_PAYMENT_METHOD,
            });
        }
    } catch (error) {
        console.error("Order placement error:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message || Messages.ERROR_IN_PLACEORDER
        });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body;
        const userId = req.session.user;

        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server configuration error: Razorpay secret key missing" });
        }

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpayOrderId + "|" + razorpayPaymentId)
            .digest('hex');

        if (generatedSignature === razorpaySignature) {
            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.ORDER_NOT_FOUND });
            }

            // Update order status
            order.paymentStatus = 'Paid';
            order.razorpayOrderId = razorpayOrderId;
            order.paymentId = razorpayPaymentId;
            order.paymentSignature = razorpaySignature;
            order.status = 'Processing';
            
            await order.save();

           
            for (const item of order.orderedItems) {
                await Product.updateOne(               //if the user order a product and place the order so at a time the quantity of product should reduce from the total product 
                    { _id: item.product },
                    { $inc: { quantity: -item.quantity } }
                );
                console.log(`Updated inventory for product ${item.product}: -${item.quantity} units`);
            }

            await Cart.findOneAndDelete({ userId });
            res.status(HttpStatus.OK).json({ success: true, message: Messages.PAYMENT_SUCCESS });
        } else {
            res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Invalid payment signature" });
        }
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message:Messages.PAYMENT_FAILED + error.message });
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
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render("errorPage", { message: Messages.INTERNAL_SERVER_ERROR});
        
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
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message:Messages.ORDER_NOT_FOUND,
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
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message: "Item not found in order",
            });
        }

        const item = order.orderedItems[itemIndex];
        // console.log("Item to cancel:", {
        //     itemId: item._id,
        //     price: item.price,
        //     quantity: item.quantity,
        //     currentStatus: item.status
        // });

        const cancellableStatuses = ["Pending", "Processing"];
        if (!cancellableStatuses.includes(item.status)) {
            // console.log(`Cannot cancel item. Current status: ${item.status}`);
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: `Cannot cancel item. Current status: ${item.status}. Cancellation only allowed for Pending or Processing items.`,
            });
        }

        const cancelledItemAmount = item.price * item.quantity;
        console.log(`Amount to be refunded: ${cancelledItemAmount}`);

        const originalFinalAmount = order.finalAmount;
        item.status = "Cancelled";
        order.orderedItems[itemIndex] = item;

        //inc of the quantity
      if(item.product ||item.product._id){
        await Product.findByIdAndUpdate(
            item.product._id,
            {$inc:{quantity:item.quantity}}

        )
      }

        const remainingActiveItems = order.orderedItems.filter(
            orderItem => orderItem.status !== "Cancelled"
        ).length;

        console.log(`Remaining active items after cancellation: ${remainingActiveItems}`);

        let refundAmount = cancelledItemAmount;
        if (remainingActiveItems > 0) {
            order.finalAmount = originalFinalAmount - cancelledItemAmount;
            console.log(`Partial cancellation - New order total: ${order.finalAmount}`);
        } else {
            refundAmount = originalFinalAmount; 
            order.status = "Cancelled";
            console.log(`Full cancellation - Refund amount: ${refundAmount}`);
        }

        if (
            (order.paymentMethod === "Razorpay" && 
             (order.paymentStatus === "Completed" || order.paymentStatus === "Paid")) ||
            order.paymentMethod === "Wallet"
        ) {
            

            if(item.quantity>2){
                refundAmount=refundAmount*0.5
                console.log('refunded to wallet',refundAmount)
            }else{
                console.log('refunded full amounnt')
            }
            

            try {
                const refundResult = await walletRefund(
                    userId,
                    refundAmount,
                    order.orderId
                );
                // console.log("Refund successful:", refundResult);
            } catch (refundError) {
                // console.error("Refund failed:", refundError);
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                    success: false,
                    message:Messages.FAILED_REFUND,
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

        return res.status(HttpStatus.OK).json({
            success: true,
            message: "Item cancelled successfully",
            refundAmount: refundAmount,
            newOrderTotal: order.finalAmount
        });
    } catch (error) {
        console.error("Order item cancellation error:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: Messages.INTERNAL_SERVER_ERROR,
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
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: Messages.INVALID_ORDER_ID
            });
        }
        
        const order = await Order.findOne({
            orderId: orderId,
            user: userId,
        }).populate('orderedItems.product');
        
        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message: Messages.ORDER_NOT_FOUND
            });
        }
        
        
        const itemIndex = order.orderedItems.findIndex(
            (item) => item._id.toString() === itemId
        );
        
        if (itemIndex === -1) {
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message: "Item not found in order",
            });
        }
        
        const item = order.orderedItems[itemIndex];
        
       
        if (item.status !== "Delivered") {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Only delivered items can be returned",
            });
        }
    
        item.status = "Return Request";
        item.returnReason = reason;
        item.returnComments = comments;
        item.returnRequestDate = new Date();
        
        order.orderedItems[itemIndex] = item;
        
        
        await order.save();
        
        return res.status(HttpStatus.OK).json({
            success: true,
            message: "Return request submitted successfully",
        });
    } catch (error) {
        console.error("Return item error:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: Messages.INTERNAL_SERVER_ERROR,
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
            return res.status(HttpStatus.NOT_FOUND).render('errorPage', {
                message:Messages.ORDER_NOT_FOUND
            });
        }
        order. deliveryCharge=100
        order.couponDiscount=order.couponDiscount||0

        if (order.user.toString() !== req.session.user) {
            return res.status(HttpStatus.FORBIDDEN).render('errorPage', {
                message: Messages.UNAUTHORIZED_ACCESS
            });
        }

        res.render('viewDetails', {
            order: order,
            
            
        });

    } catch (error) {
        console.error('Error in loadViewDetailsPage:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('errorPage', {
            message:Messages.INTERNAL_SERVER_ERROR
        });
    }
};
const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: Messages.LOGIN_REQUIRED});
        }

        const { couponId } = req.body;
        if (!couponId || !mongoose.Types.ObjectId.isValid(couponId)) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Invalid coupon ID" });
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message:Messages.COUPON_NOT_FOUND });
        }

    
        if (coupon.expiryOn < new Date()) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.COUPON_NOT_FOUND });
        }

       
        if (coupon.usedCount >= coupon.maxUsage) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message:Messages.COUPON_LIMIT_REACHED });
        }

       
        if (coupon.userId && coupon.userId.includes(userId)) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "You have already used this coupon" });
        }

   
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

        if (totalAmount < coupon.minimumPrice) {
            return res.status(HttpStatus.BAD_REQUEST).json({ 
                success: false, 
                message: `This coupon requires a minimum purchase of ₹${coupon.minimumPrice}. Your cart total is ₹${totalAmount}.`
            });
        }

        req.session.appliedCoupon = {
            couponId: coupon._id,
            discountAmount: coupon.discountAmount
        };
        console.log("Session set:", req.session.appliedCoupon); 
       

        return res.status(HttpStatus.OK).json({ 
            success: true, 
            message: Messages.COUPON_SUCCESS,
            discountAmount: coupon.discountAmount,
            finalAmount: Math.max(totalAmount + 100 - coupon.discountAmount, 0) // Assuming deliveryCharge = 100
        });
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: Messages.INTERNAL_SERVER_ERROR });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: Messages.USER_NOT_LOGEDIN});
        }

        const cartData = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: "productName productImage regularPrice salePrice quantity discount isBlocked"
            });

        if (!cartData || !cartData.items || cartData.items.length === 0) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.CART_EMPTY });
        }

        let totalAmount = cartData.items.reduce((sum, item) => {
            if (!item.productId || item.productId.isBlocked) return sum;
            const salePrice = item.productId.salePrice || item.productId.regularPrice;
            return sum + (salePrice * item.quantity);
        }, 0);

        const deliveryCharge = 100;
        req.session.appliedCoupon = null; 
        const finalAmount = totalAmount + deliveryCharge;

        res.json({
            success: true,
            finalAmount,
            message: Messages.COUPON_REMOVE_SUCCESS
        });
    } catch (error) {
        console.error("Error removing coupon:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: Messages.INTERNAL_SERVER_ERROR
        });
    }
};

const generateInvoicePDF = (order, res) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

   
    const leftMargin = 50;
    const rightEdge = 550;
    
 
    const itemCol = leftMargin;
    const qtyCol = leftMargin + 250;  
    const priceCol = qtyCol + 70;     
    const statusCol = priceCol + 70;  
    const totalCol = statusCol + 90;  
    
 
    doc.fontSize(20).text('Elegane Carry', { align: 'center' });
    doc.fontSize(14).text('Tax Invoice/Bill of Supply', { align: 'center' });
    doc.moveDown();


    doc.fontSize(12).text(`Invoice Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: 'left' });
    doc.text(`Order ID: ${order.orderId}`, { align: 'left' });
    doc.moveDown();

    doc.fontSize(14).text('BILLING ADDRESS:', { underline: true });
    doc.fontSize(12)
       .text(`${order.address.name}`)
       .text(`${order.address.addressType}, ${order.address.city}`)
       .text(`POST - ${order.address.landMark}`)
       .text(`${order.address.state} - ${order.address.pincode}`)
       .text(`PHONE: ${order.address.phone}`);
    doc.moveDown(1.5);

   
    doc.fontSize(14).text('Order Items:', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(12);
    doc.text('Item', itemCol, doc.y);
    doc.text('Qty', qtyCol, doc.y - 12, { width: 70, align: 'center' });
    doc.text('Price', priceCol, doc.y - 12, { width: 70, align: 'right' });
    doc.text('Status', statusCol, doc.y - 12, { width: 90, align: 'center' });
    doc.text('Total', totalCol, doc.y - 12, { width: 70, align: 'right' });
    
    doc.moveTo(leftMargin, doc.y + 5).lineTo(rightEdge, doc.y + 5).stroke();
    doc.moveDown(1);

 
    let activeSubtotal = 0;
    let cancelledAmount = 0;
    let returnedAmount = 0;

    order.orderedItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        const startY = doc.y;
        
   
        let itemStatus = item.status || 'Processing';
        let textColor = itemStatus === 'Cancelled' || itemStatus === 'Returned' ? 'red' : 'black';
        
        if (itemStatus === 'Returned') {
            returnedAmount += itemTotal;
        } else if (itemStatus === 'Cancelled') {
            cancelledAmount += itemTotal;
            doc.fillColor('red');
        } else {
            activeSubtotal += itemTotal;
        }

       
        doc.fillColor(textColor)
           .text(item.product.productName, itemCol, startY, { 
               width: qtyCol - itemCol - 10,
               align: 'left'
           });
           
      
        const newY = Math.max(doc.y, startY);
        
       
        doc.text(item.quantity.toString(), qtyCol, startY, { 
            width: 70,
            align: 'center' 
        });
        
      
        doc.text(`₹${item.price}`, priceCol, startY, { 
            width: 70,
            align: 'right' 
        });
        
    
        doc.text(itemStatus, statusCol, startY, { 
            width: 90,
            align: 'center' 
        });
        
 
        doc.text(`₹${itemTotal}`, totalCol, startY, { 
            width: 70,
            align: 'right' 
        });
        
        doc.fillColor('black'); 
        doc.y = newY; 
        doc.moveDown(1); 
    });

   
    doc.moveTo(leftMargin, doc.y).lineTo(rightEdge, doc.y).stroke();
    doc.moveDown(1);

    const summaryX = 350;
    const summaryValueX = 500;
    
    // Subtotal
    doc.text('Subtotal:', summaryX, doc.y, { align: 'left' });
    doc.text(`₹${activeSubtotal}`, summaryValueX, doc.y - 12, { align: 'right' });
    doc.moveDown(0.5);
    
    // Cancelled Amount
    if (cancelledAmount > 0) {
        doc.fillColor('red');
        doc.text('Cancelled Amount:', summaryX, doc.y, { align: 'left' });
        doc.text(`-₹${cancelledAmount}`, summaryValueX, doc.y - 12, { align: 'right' });
        doc.fillColor('black');
        doc.moveDown(0.5);
    }
    
    // Returned Amount
    if (returnedAmount > 0) {
        doc.fillColor('red');
        doc.text('Returned Amount:', summaryX, doc.y, { align: 'left' });
        doc.text(`-₹${returnedAmount}`, summaryValueX, doc.y - 12, { align: 'right' });
        doc.fillColor('black');
        doc.moveDown(0.5);
    }
    
    // Shipping
    doc.text('Shipping:', summaryX, doc.y, { align: 'left' });
    doc.text(`₹${order.deliveryCharge || 100}`, summaryValueX, doc.y - 12, { align: 'right' });
    doc.moveDown(0.5);
    
    // Final amount
    const finalAmount = activeSubtotal + (order.deliveryCharge || 100);
    
    // Draw a line before the final total
    doc.moveTo(summaryX, doc.y).lineTo(rightEdge, doc.y).stroke();
    doc.moveDown(0.5);
    
    // Total amount
    doc.fontSize(14);
    doc.text('TOTAL AMOUNT:', summaryX, doc.y, { align: 'left' });
    doc.text(`₹${finalAmount}`, summaryValueX, doc.y - 12, { align: 'right' });
    
    // Footer
    const footerY = doc.page.height - 100;
    doc.fontSize(10).text('Thank you for shopping with Elegane Carry!', 50, footerY, { align: 'center' });
    
    if (returnedAmount > 0 || cancelledAmount > 0) {
        doc.fontSize(9).fillColor('red')
           .text('Note: This invoice reflects cancelled/returned items. Refunds are processed separately.', 
                 50, footerY + 20, { align: 'center' });
    }

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
                return res.status(HttpStatus.NOT_FOUND).render('pageerror',{
                    messsage:Messages.ORDER_NOT_FOUND
                })
            }
        if(order.user.toString()!==req.session.user){
            return res.status(HttpStatus.FORBIDDEN).render('pageerror',{
                message:Messages.UNAUTHORIZED_ACCESS
            })
        }
        generateInvoicePDF(order,res)

    } catch (error) {
        console.error('Error in downloadInvoice:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('pageerror', {
            message: Messages.INTERNAL_SERVER_ERROR
        });
    }
        
}
const retryPayment = async (req, res) => {
    try {
        const { orderId, razorpayOrderId } = req.body; 
        const userId = req.session.user;

       
        if (!userId) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message:Messages.LOGIN_REQUIRED });
        }

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.INVALID_ORDER_ID});
        }

        console.log("Fetching order with ID:", orderId);
        const order = await Order.findById(orderId).populate('orderedItems.product');
        if (!order) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message:Messages.ORDER_NOT_FOUND });
        }
        if (order.paymentStatus !== 'Failed' || order.paymentMethod !== 'Razorpay') {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Invalid order for retry" });
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message:Messages.RAZORPAY_CONFIGURATION
            });
        }

       
        let totalAmount = order.orderedItems.reduce((sum, item) => {
            const price = item.product.salePrice || item.product.regularPrice || item.price;
            return sum + (price * item.quantity);
        }, 0);

        let couponDiscount = order.couponDiscount || 0;
        let appliedCouponCode = order.couponCode || null;

      
        if (order.couponId) {
            const coupon = await Coupon.findById(order.couponId);
            if (coupon && coupon.expiryOn >= new Date() && coupon.usedCount < coupon.maxUsage) {
                if (!coupon.userId || !coupon.userId.includes(userId)) {
                    couponDiscount = coupon.discountAmount;
                    appliedCouponCode = coupon.name;

                } else {
                    console.log("User has already used this coupon during retry:", userId);
                    couponDiscount = 0; 
                }
            } else {
                console.log("Coupon invalid or expired during retry:", order.couponId);
                couponDiscount = 0; 
            }
        }

        const deliveryCharge = 100; 
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
        order.couponDiscount = couponDiscount; 
        order.finalAmount = finalAmount; 
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
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: Messages.INTERNAL_SERVER_ERROR });
    }
};


const updateOrderStatusOnFailure = async (req, res) => {
    try {
        const { orderId, razorpayOrderId } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message:Messages.ORDER_NOT_FOUND
            });
        }

        order.paymentStatus = "Failed";
        order.status = "Pending"; 
        await order.save();

        
        return res.status(HttpStatus.OK).json({
            success: true,
            message: "Order status updated to Failed",
        });
    } catch (error) {
        console.error("Error updating order status on failure:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: Messages.INTERNAL_SERVER_ERROR
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
