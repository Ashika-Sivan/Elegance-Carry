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
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require('../../enum/messages');


const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    if(!userId){
      return res.redirect('/login')
    }
    
    const user = await User.findById(userId);
   
    
  
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
    // console.error("Error in wishlist route:", error);
    return res.status(500).render("error", { message:Messages.INTERNAL_SERVER_ERROR });
  }
};

const updateWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    if(!mongoose.Types.ObjectId.isValid(productId)){
      return res.json({
        success:false,
        message: Messages.INVALID_PRODUCT_ID
      })
    }

    if (!userId) {
      return res.json({ 
        success: false, 
        message: Messages.LOGIN_REQUIRED, 
        redirectToLogin: true 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.json({ 
        success: false, 
        message: Messages.USER_NOT_FOUND, 
        redirectToLogin: true 
      });
    }


    const product=await Product.findById(productId);
    if(!product||product.isBlocked){
      return res.json({
        success:false,
        message:Messages.PRODUCT_NOT_FOUND
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
    console.log(Messages.WISHLIST_ADD_SUCCESS);
    console.log(Messages.WISHLIST_REMOVE_SUCCESS)
    
      return res.status(HttpStatus.OK).json({
      success: true, 
      action: action,
      message: action === 'added' ?  Messages.WISHLIST_ADD_SUCCESS :  Messages.WISHLIST_REMOVE_SUCCESS

    });
    
  } catch (error) {
    // console.error("Error updating wishlist:", error);
    return res.status(500).json({
      success: false,
      message:Messages.INTERNAL_SERVER_ERROR
    });
  }
};


module.exports={
    loadWishlist,
    updateWishlist,
    
}