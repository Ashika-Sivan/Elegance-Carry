const User=require("../../models/userSchema")
const nodemailer=require("nodemailer")
const bcrypt=require("bcrypt")
const env=require("dotenv").config();
const session= require("express-session")
const Address=require("../../models/addressSchema")
const Product=require("../../models/productSchema")
const Wishlist=require("../../models/wishlistSchema")
const Cart=require("../../models/cartSchema")
const Category=require("../../models/categorySchema")
const path = require('path');
const mongoose = require("mongoose");
const Order=require("../../models/orderSchema")
const Coupon=require("../../models/couponSchema")
const Wallet=require("../../models/walletSchema")
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require('../../enum/messages');


const loadCartPage = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        const cartItems = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: 'productName salePrice productImage quantity'
            });

        let totalAmount = 0;
        let totalQuantity = 0;

        if (cartItems && cartItems.items) {
            cartItems.items.forEach(item => {
                totalAmount += item.totalPrice;
                totalQuantity += item.quantity;
            });
        }
        //to check the total stock 
        const products = await Product.find();
        const productsWithStock = products.map(product => ({
            ...product.toObject(),
            isOutOfStock: product.quantity <= 0, 
        }));

        res.render("cart", {
            user: userData,
            cart: cartItems,
            totalAmount,
            totalQuantity,
            products: productsWithStock 
        });
    } catch (error) {
        console.error("Error loading cart:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({success:false,message:Messages.INTERNAL_SERVER_ERROR})

        
        
    }
};




const postAddToCart = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: Messages.USER_NOT_LOGEDIN });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message:Messages.PRODUCT_NOT_FOUND });
        }

        if (product.quantity <= 0) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.PRODUCT_OUT_OF_STOCK});
        }

        if(product.isBlocked){
            return res.status(HttpStatus.FORBIDDEN).json({success:false,message:Messages.PRODUCT_BLOCKED})
        }

        const price = product.salePrice || product.price;
        let cart = await Cart.findOne({ userId });//check the user has cart

        if (!cart) {
            cart = new Cart({
                userId,
                items: [{
                    productId,
                    quantity: 1,
                    price: price,
                    totalPrice: price
                }]
            });
        } else {
            const existingItem = cart.items.find(item => 
                item.productId.toString() === productId.toString()
            );

            if (existingItem) {
                if (existingItem.quantity >= 3) {
                    return res.json({ 
                        success: false, 
                        message: "Maximum quantity of this product added to cart is 3" 
                    });
                }
                if (existingItem.quantity >= product.quantity) {
                    return res.json({ 
                        success: false, 
                        message: `Only ${product.quantity} available in stock` 
                    });
                }



                existingItem.quantity += 1;
                existingItem.totalPrice = existingItem.quantity * existingItem.price;
            } else {
                if (1 > product.quantity) {
                    return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message:Messages.INSUFFICIENT_STOCK });
                }
                
                cart.items.push({
                    productId,
                    quantity: 1,
                    price: price,
                    totalPrice: price
                });
            }
        }
        await cart.save();
        res.status(HttpStatus.OK).json({ success: true, message:Messages.CART_ADD_SUCCESS });
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: Messages.INTERNAL_SERVER_ERROR });
    }
};

const updateCartQuantity = async (req, res) => {
    try {
        const { productId, change } = req.body;
        const userId = req.session.user;

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message: Messages.CART_NOT_FOUND
            });
        }

        const cartItem = cart.items.find(item => 
            item.productId.toString() === productId.toString()
        );

        if (!cartItem) {
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message: 'item not found'
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message: Messages.PRODUCT_NOT_FOUND
            });
        }

        const newQuantity = cartItem.quantity + change;

        if (newQuantity < 1) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Quantity cannot be less than 1"
            });
        }

        if (newQuantity > 3) {
            return res.status(400).json({
                success: false,
                message: "Maximum quantity of this product added to cart is 3"
            });
        }

        if (newQuantity > product.quantity) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: `Only ${product.quantity} available in stock`
            });
        }

        cartItem.quantity = newQuantity;
        cartItem.totalPrice = newQuantity * cartItem.price;

        await cart.save();

        const totalAmount = cart.items.reduce((total, item) => total + item.totalPrice, 0);//total sum of product

        res.status(HttpStatus.OK).json({
            success: true,
            newQuantity: cartItem.quantity,
            totalAmount: totalAmount
        });

    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: Messages.INTERNAL_SERVER_ERROR
        });
    }
};


const removeFromCart = async (req, res) => {
        try {
            const { productId } = req.body;
            const userId = req.session.user;
    
            if (!userId) {
                return res.status(HttpStatus.UNAUTHORIZED).json({
                    success: false,
                    message: Messages.USER_NOT_LOGEDIN
                });
            }
    
            const cart = await Cart.findOne({ userId });
    
            if (!cart) {
                return res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    message: Messages.CART_NOT_FOUND
                });
            }
    
            
            cart.items = cart.items.filter(
                (item) => item.productId.toString() !== productId.toString()
            );
    
            await cart.save();    
            const newTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    
            res.json({
                success: true,
                message: Messages.CART_REMOVE_SUCCESS,
                newTotal: newTotal,
            });
        } catch (error) {
            console.error("Error removing item from cart:", error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: Messages.INTERNAL_SERVER_ERROR
            });
        }
    };


const loadCheckOutPage = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            console.log("User not found");
            return res.redirect("/login");
        }

        const addressData = await Address.findOne({ userId });
        const addresses = addressData ? addressData.address : [];
        const defaultAddress = addresses.find(addr => 
            addr._id.equals(userData.defaultAddressId)
        ) || addresses[0];

        
        const cartData = await Cart.findOne({ userId })
            .populate({
                path: 'items.productId',
                select: "productName productImage regularPrice salePrice quantity discount isBlocked"
            });

        if (!cartData || !cartData.items || cartData.items.length === 0) {
            return res.render("check-out", {
                user: userData,
                addresses: addresses,
                defaultAddress,
                cart: null,
                totalAmount: 0,
                order: null,
                totalDiscount: 0,
                finalAmount: 0,
                discount: 0,
                deliveryCharge: 0,
                coupons: [],
                couponDiscount: 0,
                message:Messages.CART_EMPTY
            });
        }

      
        let totalAmount = 0;        
        if (cartData && cartData.items) {
            totalAmount = cartData.items.reduce((sum, item) => {
                if (!item.productId || item.productId.isBlocked) return sum;
                const salePrice = item.productId.salePrice || item.productId.regularPrice;
                return sum + (salePrice * item.quantity);
            }, 0);
        }
        const discount = cartData.items.reduce((total, item) => {
            if (!item.productId || item.productId.isBlocked) return total;
            const regularPrice = item.productId.regularPrice || 0;
            const salePrice = item.productId.salePrice || regularPrice;
            return total + (regularPrice - salePrice) * item.quantity;
        }, 0);

        console.log("Total Amount:", totalAmount);
        console.log("Discount:", discount);

      
        const coupons = await Coupon.find({
            expiryOn: { $gte: new Date() },
            isList: true,
            $expr: { $lte: ["$usedCount", "$maxUsage"] },
            userId: { $ne: userId },
            minimumPrice: { $lte: totalAmount }
        })
        .sort({ discountAmount: -1 })
        .limit(5); 
       
        let cartTotal = 0;
        let totalDiscount = 0;

        cartData.items.forEach((item) => {
            if (!item.productId || item.productId.isBlocked) return;

            const regularPrice = item.productId.regularPrice || 0;
            const salePrice = item.productId.salePrice || regularPrice;
            const itemDiscount = regularPrice - salePrice;

            cartTotal += salePrice * item.quantity;
            totalDiscount += itemDiscount * item.quantity;
        });

        const deliveryCharge = 100;
        let couponDiscount = 0;

        
        if (req.session.appliedCoupon) {
            const appliedCoupon = await Coupon.findById(req.session.appliedCoupon.couponId);
            if (appliedCoupon && totalAmount >= appliedCoupon.minimumPrice && appliedCoupon.usedCount < appliedCoupon.maxUsage && appliedCoupon.expiryOn >= new Date()) {
                couponDiscount = appliedCoupon.discountAmount;
                req.session.appliedCoupon.code = appliedCoupon.name; 
            } else {
                req.session.appliedCoupon = null;
            }
        }

        const finalAmount = Math.max(totalAmount + deliveryCharge - couponDiscount, 0);

        const orderData = await Order.findOne({ userId });
        
        let wallet = await Wallet.findOne({userId});
        if(!wallet){
            wallet = new Wallet({
                userId,
                balance: 0,
                walletHistory: [{
                    transactionType: "credit",
                    amount: 0,
                    description: "Initial balance"
                }],
            });
            await wallet.save();
            console.log("New wallet created for user:", userId);
        }

        res.render("check-out", { 
            user: userData,
            addresses: addresses,
            defaultAddress,
            cart: cartData,
            totalAmount,
            order: orderData,
            totalDiscount,
            finalAmount,
            discount,
            deliveryCharge,
            coupons,
            couponDiscount,
            walletBalance: wallet.balance,
            req
        });
    } catch (error) {
        console.error("Error loading checkout page:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render("page-404", { 
            message: Messages.INTERNAL_SERVER_ERROR
        });
    }
};








module.exports={
    loadCartPage,
    postAddToCart,
    updateCartQuantity,
    removeFromCart,
    loadCheckOutPage

}