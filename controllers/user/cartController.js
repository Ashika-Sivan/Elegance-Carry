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

        // Check stock availability for each item
        const products = await Product.find();
        const productsWithStock = products.map(product => ({
            ...product.toObject(),//convert the db obj to plain js object
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
        // res.status(500).render("errorPage", { message: "Failed to load cart" });
    }
};


const postAddToCart = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.json({ success: false, message: "User not logged in" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.json({ success: false, message: "Product not found" });
        }

        if (product.quantity <= 0) {
            return res.json({ success: false, message: "This product is out of stock" });
        }

        const price = product.salePrice || product.price;
        let cart = await Cart.findOne({ userId });

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
                item.productId.toString() === productId
            );

            if (existingItem) {
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
                    return res.json({ success: false, message: "Not enough stock available" });
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
        res.json({ success: true, message: "Product added to cart" });
    } catch (error) {
        console.error("Error adding to cart:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};


const updateCartQuantity = async (req, res) => {
    try {
        const { productId, change } = req.body;
        const userId = req.session.user;

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        const cartItem = cart.items.find(item => 
            item.productId.toString() === productId.toString()
        );

        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: "Product not found in cart"
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        const newQuantity = cartItem.quantity + change;

        if (newQuantity < 1) {
            return res.status(400).json({
                success: false,
                message: "Quantity cannot be less than 1"
            });
        }

        if (newQuantity > product.quantity) {
            return res.status(400).json({
                success: false,
                message: `Only ${product.quantity} available in stock`
            });
        }

        cartItem.quantity = newQuantity;
        cartItem.totalPrice = newQuantity * cartItem.price;

        await cart.save();

        const totalAmount = cart.items.reduce((total, item) => total + item.totalPrice, 0);//total sum of product

        res.json({
            success: true,
            newQuantity: cartItem.quantity,
            totalAmount: totalAmount
        });

    } catch (error) {
        console.error("Error updating cart quantity:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


    const removeFromCart = async (req, res) => {
        try {
            const { productId } = req.body;
            const userId = req.session.user;
    
            if (!userId) {
                return res.json({
                    success: false,
                    message: "User not logged in",
                });
            }
    
            const cart = await Cart.findOne({ userId });
    
            if (!cart) {
                return res.json({
                    success: false,
                    message: "Cart not found",
                });
            }
    
            // Remove item from cart
            cart.items = cart.items.filter(
                (item) => item.productId.toString() !== productId.toString()
            );
    
            await cart.save();
           

    
            // Calculate new total amount
            const newTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);
    
            res.json({
                success: true,
                message: "Item removed from cart",
                newTotal: newTotal,
            });
        } catch (error) {
            console.error("Error removing item from cart:", error);
            res.status(500).json({
                success: false,
                message: "Internal server error",
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
    
            // Fetch cart data
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
                    message: "Your cart is empty"
                });
            }
    
            // Calculate totalAmount before querying coupons
            let totalAmount = 0;
            if (cartData && cartData.items) {
                totalAmount = cartData.items.reduce((sum, item) => {
                    if (!item.productId || item.productId.isBlocked) return sum;
                    const salePrice = item.productId.salePrice || item.productId.regularPrice;
                    return sum + (salePrice * item.quantity);
                }, 0);
            }
    
            // Calculate total discount (difference between regularPrice and salePrice)
            const discount = cartData.items.reduce((total, item) => {
                if (!item.productId || item.productId.isBlocked) return total;
                const regularPrice = item.productId.regularPrice || 0;
                const salePrice = item.productId.salePrice || regularPrice;
                return total + (regularPrice - salePrice) * item.quantity;
            }, 0);
    
            console.log("Total Amount:", totalAmount);
            console.log("Discount:", discount);
    
            // Fetch coupons after calculating totalAmount
            const coupons = await Coupon.find({
                expiryOn: { $gte: new Date() },
                isList: true,
                $expr: { $lte: ["$usedCount", "$maxUsage"] },
                userId: { $ne: userId },
                minimumPrice: { $lte: totalAmount } // Now uses the correct totalAmount
            });
    
            // console.log("Coupons:", coupons);
    
            // Calculate cartTotal and totalDiscount
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
    
            // Check if a coupon is applied in the session
            if (req.session.appliedCoupon) {
                const appliedCoupon = await Coupon.findById(req.session.appliedCoupon.couponId);
                if (appliedCoupon && totalAmount >= appliedCoupon.minimumPrice && appliedCoupon.usedCount < appliedCoupon.maxUsage && appliedCoupon.expiryOn >= new Date()) {
                    couponDiscount = appliedCoupon.discountAmount;
                    req.session.appliedCoupon.code = appliedCoupon.name; // Store coupon code
                } else {
                    req.session.appliedCoupon = null;
                }
            }
    
            const finalAmount = Math.max(totalAmount + deliveryCharge - couponDiscount, 0);
    
            const orderData = await Order.findOne({ userId });
            const wallet =await Wallet.findOne({userId})
            if(!wallet){
                return res.status(404).json({message:"wallet not found"})
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
                walletBalance:wallet.balance,
                req
            });
        } catch (error) {
            console.error("Error loading checkout page:", error);
            res.status(500).render("errorPage", { 
                message: "Failed to load checkout page" 
            });
        }``
    };











module.exports={
    loadCartPage,
    postAddToCart,
    updateCartQuantity,
    removeFromCart,
    loadCheckOutPage

}