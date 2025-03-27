
const User = require("../../models/userSchema")
const nodemailer = require("nodemailer")
const env = require('dotenv').config();
const bcrypt = require('bcrypt');
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Brand = require('../../models/brandSchema')
const Wallet = require("../../models/walletSchema")
const Wishlist = require("../../models/wishlistSchema")
const { v4: uuidv4 } = require('uuid');

const pageNotFound = async (req, res, next) => {
  try {
    res.render("page-404");
  } catch (error) {
    next(error);
  }
};

const loadSignup = async (req, res) => {
  try {
    return res.render('signup')

  } catch (error) {
    console.log('home not loading:', error);
    res.status(500).send('server error')
  }
}


const loadHomePage = async (req, res) => {
  try {
    const userId = req.session.user;
    let user = null;
   
    if (userId) {
      user = await User.findById(userId);
      
      if (user && user.isBlocked) {
        req.session.destroy((err) => {
          if (err) {
            console.error("Error destroying session:", err);
          }
          return res.redirect("/login");  
        });
        return; 
      }
    }


    const bestSellerProducts = await Product.find({ isBlocked: false })
      .populate("category")
      .populate("brand")
      .sort({ soldCount: -1 }) 
      .limit(8);


    const featuredProducts = await Product.find({
      isBlocked: false,
      isFeatured: true,
      $or: [
        { 'productOffer': { $gt: 0 } },
        { 'category.categoryOffer': { $gt: 0 } }
      ]
    })
      .populate("category")
      .populate("brand")
      .limit(8);





    const processProducts = async (products) => {
      return await Promise.all(products.map(async (product) => {
        const productData = product.toObject(); 


        if (userId) {
          const wishlist = await Wishlist.findOne({ userId });
          productData.inWishlist = wishlist ? wishlist.products.includes(product._id) : false;
        } else {
          productData.inWishlist = false;
        }

        
        const categoryOffer = product.category?.categoryOffer || 0;
        const productOfferPercentage = product.productOffer || 0;

        const offerPercentage = Math.max(productOfferPercentage, categoryOffer);
        const offerType = productOfferPercentage > categoryOffer ? "product" : "category";

        if (offerPercentage > 0) {
          productData.activeOffer = {
            type: offerType,
            percentage: offerPercentage
          };
        }
        return productData;
      }));
    };

    const processedBestSellers = await processProducts(bestSellerProducts);
    const processedFeaturedProducts = await processProducts(featuredProducts);

    res.render("home", {
      user,
      products: processedBestSellers,
      featuredProducts: processedFeaturedProducts
    });
  } catch (error) {
    console.error("Error loading home page:", error);
    res.status(500).render("errorPage", { message: "Failed to load home page" });
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    })
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "verify your account",
      text: `your otp is ${otp}`,
      html: `<b>your otp is ${otp}</b>`,
    })
    return info.accepted.length > 0

  } catch (error) {
    console.log("error sending email", error);
    return false;
  }
}

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10)
    return passwordHash;



  } catch (error) {

  }
}





const createReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const signupBonus = 50;
const referralBonus = 100;

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cPassword, referalCode } = req.body;

    
    if (password !== cPassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }

    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", { message: "User with this email already exists" });
    }

    const userReferralCode = createReferralCode();

   
    let referredByUser = null;
    if (referalCode) {
      referredByUser = await User.findOne({ referalCode });
      if (!referredByUser) {
        return res.render("signup", {
          message: "The referral code you entered is invalid",
        });
      }
    }

  
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("signup", { message: "Error sending email" });
    }

   
    req.session.userOtp = otp;
    req.session.otpCreatedAt = Date.now(); 
    req.session.userData = {
      name,
      phone,
      email,
      password,
      referalCode: referalCode || null,
      userReferralCode,
      referredBy: referredByUser ? referredByUser._id : null,
    };
    req.session.otpExpiry = Date.now() + 5 * 60 * 1000; 

    console.log("OTP Sent", otp);
    res.render("verify-otp");
  } catch (error) {
    console.log("Signup error:", error);
    res.redirect("/pageNotFound");
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    
    if (!req.session.userOtp || !req.session.userData || !req.session.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: "Session expired. Please try signing up again.",
      });
    }

    
    const now = Date.now();
    if (now > req.session.otpExpiry) {
      delete req.session.userOtp;
      delete req.session.userData;
      delete req.session.otpExpiry;
      delete req.session.otpCreatedAt;

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please try signing up again.",
      });
    }

   
    if (otp.toString() !== req.session.userOtp.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP, please try again.",
      });
    }

    const user = req.session.userData;
    const passwordHash = await securePassword(user.password);

  
    const saveUserData = new User({
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: passwordHash,
      referalCode: user.userReferralCode,
      redeemed: false,
      redeemedUsers: [],
    });

    await saveUserData.save();
    console.log("New user created:", saveUserData._id);


    if (user.referredBy) {
      
      const referrerWallet = await Wallet.findOne({ userId: user.referredBy });

      if (referrerWallet) {
        referrerWallet.balance = Number(referrerWallet.balance) + referralBonus;
        referrerWallet.walletHistory.push({
          transactionId: uuidv4(),
          transactionType: "credit",
          amount: referralBonus,
          description: "Referral bonus",
        });
        await referrerWallet.save();
      } else {
        
        const newReferrerWallet = new Wallet({
          userId: user.referredBy,
          balance: referralBonus,
          walletHistory: [
            {
              transactionId: uuidv4(),
              transactionType: "credit",
              amount: referralBonus,
              description: "Referral bonus",
            },
          ],
        });
        await newReferrerWallet.save();
      }

      await User.findByIdAndUpdate(
        user.referredBy,
        { $push: { redeemedUsers: saveUserData._id } }
      );

      console.log("Referral bonus credited to referrer:", user.referredBy);
    }

   
    const newUserWallet = new Wallet({
      userId: saveUserData._id,
      balance: signupBonus,
      walletHistory: [
        {
          transactionId: uuidv4(),
          transactionType: "credit",
          amount: signupBonus,
          description: "Signup bonus",
        },
      ],
    });
    await newUserWallet.save();


    delete req.session.userOtp;
    delete req.session.userData;
    delete req.session.otpExpiry;
    delete req.session.otpCreatedAt;


    req.session.user = saveUserData._id;

    return res.json({
      success: true,
      message: "Registration successful",
      redirectUrl: "/"
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred during verification.",
    });
  }
};

const verifyReferral = async (req, res) => {
  try {
    const { referalCode } = req.body;


    if (!referalCode || referalCode.length !== 6) {
      return res.json({ valid: false });
    }


    const referredByUser = await User.findOne({ referalCode: referalCode });

    if (referredByUser) {
      return res.json({
        valid: true,
        referrerName: referredByUser.name.split(' ')[0]
      });
    } else {
      return res.json({ valid: false });
    }
  } catch (error) {
    console.error("Error verifying referral code:", error);
    return res.status(500).json({ valid: false, error: "Server error" });
  }
};

const creditWallet = async (userId, amount, description) => {
  try {
  
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
        walletHistory: []
      });
    }

  
    wallet.balance += amount;

    wallet.walletHistory.push({
      transactionType: 'credit',
      amount,
      description
    });

    await wallet.save();
    return true;
  } catch (error) {
    console.error("Error crediting wallet:", error);
    return false;
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    console.log("email-------------", email);

    if (!email) {
      return res.status(400).json({ success: false, message: "email not found in session" })
    }
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.status(400).json({ success: false, message: "Failed to send otp,please try again" })
    }
    req.session.userOtp = otp;
    req.session.otpExpiry = Date.now() + 5 * 60 * 1000

    console.log('the resend otp is ', otp);
    res.status(200).json({ success: true, message: "Otp Sent to the email Succesfullyy" })

  } catch (error) {
    console.error("Error resending OTP ", error);
    res.status(500).json({ success: false, message: "internal server Error.Please try again" })


  }
}

const resendForgotOtp = async (req, res) => {
  try {
   
    if (!req.session.forgotPassEmail) {
      return res.status(400).json({
        success: false,
        message: "Email not found in session"
      });
    }

    const email = req.session.forgotPassEmail;
    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.status(400).json({
        success: false,
        message: "Failed to send OTP. Please try again."
      });
    }

   
    req.session.forgotPassOtp = otp;
    req.session.otpExpiry = Date.now() + 60 * 1000;

    res.status(200).json({
      success: true,
      message: "OTP sent successfully"
    });

  } catch (error) {
    console.error("Error in resendForgotOtp:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again."
    });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) { 
      return res.render("login")
    } else {
      res.redirect("/")
    }

  } catch (error) {
    res.redirect("/pageNotFound")

  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: false, email })
    if (!findUser) {
      return res.render("login", { message: "User not found" })

    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "User is blocked by admin" })
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password)
    if (!passwordMatch) {
      return res.render("login", { message: "incorrect password" })

    }
    req.session.user = findUser._id;
    req.session.isAuthenticated=true
    console.log("Session saved user:", req.session.user);
    res.redirect("/")

  } catch (error) {
    console.error("login error", error);
    res.render("login", { message: "login failed.please try again" })


  }
}

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log('session destruction error', err.message);
        return res.redirect("/pageNotFound")

      }
      return res.redirect("/login")
    })


  } catch (error) {
    console.log("logout error", error);
    res.redirect("/pageNotFound")


  }
}

const loadShoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findById(user);
    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map(category => category._id.toString());
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const sortOptions = {
      featured: { createdAt: -1 },
      priceLowHigh: { salePrice: 1 },
      priceHigh: { salePrice: -1 },
      balance: { quantity: -1 },
      nameAsc: { productName: 1 },
      nameDesc: { productName: -1 }
    };

    const currentSort = req.query.sort || "featured";

    const query = {
      isBlocked: false
    };

   
    if (req.query.category) {
      query.category = req.query.category;
    } else {
      query.category = { $in: categoryIds };
    }

    
    if (req.query.brand) {
      query.brand = req.query.brand;
    }


    if (req.query.search) {
      query.productName = { $regex: new RegExp(req.query.search, 'i') };
    }

    const products = await Product.find(query)
      .populate("brand", "name")
      .populate("category", "name")
      .sort(sortOptions[currentSort] || sortOptions["featured"])
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);
    const brands = await Brand.find({ isBlocked: false });


    const processedProducts = await Promise.all(products.map(async (product) => {
      const productData = product.toObject();

      if (user) {
        const wishlist = await Wishlist.findOne({ userId: user });
        productData.inWishlist = wishlist ? wishlist.products.includes(product._id) : false;
      } else {
        productData.inWishlist = false;
      }

      const categoryOffer = product.category?.categoryOffer || 0;
      productData.activeOffer = {
        type: product.productOffer > categoryOffer ? "product" : "category",
        percentage: Math.max(product.productOffer, categoryOffer),
        savings: product.regularPrice - product.salePrice 
      };

      return productData;
    }));


    const categoriesWithIds = categories.map(category => ({
      _id: category._id,
      name: category.name
    }));

    const sortLabels = {
      featured: "Featured",
      priceLowHigh: "Price: Low to High",
      priceHigh: "Price: High to Low",
      balance: "Stock Balance",
      nameAsc: "A to Z",
      nameDesc: "Z to A"
    };

  
    const activeFilters = {
      category: req.query.category || null,
      brand: req.query.brand || null
    };

    res.render("shop", {
      user: userData,
      products: products,
      category: categoriesWithIds,
      brand: brands,
      currentPage: page,
      totalPages: totalPages,
      sortLabels: sortLabels,
      currentSort: currentSort,
      activeFilters: activeFilters,
      query: req.query
    });

  } catch (error) {
    console.log("loadShoppingPage", error);
    res.redirect("/pageNotFound");
  }
};


module.exports = {
  loadHomePage,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  pageNotFound,
  login,
  logout,
  loadShoppingPage,
  resendForgotOtp,
  creditWallet,
  verifyReferral
}

