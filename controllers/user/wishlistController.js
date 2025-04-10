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


const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.redirect('/login');
    }
    
  
    const wishlist = await Wishlist.findOne({ userId: userId });
    
    let wishlistProducts = [];
    if (wishlist && wishlist.products.length > 0) {

      const productIds = wishlist.products.map(item => item.productId);
      
      
      wishlistProducts = await Product.find({ _id: { $in: productIds } }).populate('category');
    }
    
    return res.render("wishlist", {
      products: wishlistProducts,
      itemCount: wishlistProducts.length
    });
  } catch (error) {
    console.error("Error in wishlist route:", error);
    return res.status(500).render("error", { message: "Something went wrong loading your wishlist" });
  }
};

const updateWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    if(!mongoose.Types.ObjectId.isValid(productId)){
      return res.json({
        success:false,
        message:'invalid product id'
      })
    }

    if (!userId) {
      return res.json({ 
        success: false, 
        message: "Please login to add items to wishlist", 
        redirectToLogin: true 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.json({ 
        success: false, 
        message: "User not found", 
        redirectToLogin: true 
      });
    }




    const product=await Product.findById(productId);
    if(!product&&product.isBlocked){
      return res.json({
        success:false,
        message:"product not found or unavailable"
      })
    }
    let wishlist = await Wishlist.findOne({ userId: userId });
    let action;

    if (wishlist) {
      const productIndex = wishlist.products.findIndex(
        item => item.productId.toString() === productId
      );

      if (productIndex > -1) {
        wishlist.products.splice(productIndex, 1);
        action = 'removed';
      } else {
        wishlist.products.push({
          productId: productId,
          addedOn: new Date()
        });
        action = 'added';
      }

      await wishlist.save();
    } else {
      wishlist = new Wishlist({
        userId: userId,
        products: [{
          productId: productId,
          addedOn: new Date()
        }]
      });
      await wishlist.save();
      action = 'added';
    }

    return res.json({ 
      success: true, 
      action: action,
      message: action === 'added' ? 'Product added to wishlist' : 'Product removed from wishlist'
    });
    
  } catch (error) {
    console.error("Error updating wishlist:", error);
    return res.json({ 
      success: false, 
      message: "An error occurred while updating your wishlist" 
    });
  }
};


module.exports={
    loadWishlist,
    updateWishlist,
    
}