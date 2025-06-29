const express=require("express")
const router=express.Router();
const passport=require("passport")
const userController=require("../controllers/user/userController.js")
router.get("/pageNotFound",userController.pageNotFound);
const {userAuth,adminAuth}=require("../middlewares/auth")
const productController=require("../controllers/user/productController")
const profileController=require("../controllers/user/profileController.js")
const cartController=require("../controllers/user/cartController.js")
const orderController=require("../controllers/user/orderController")
const path = require('path');
const wishlistController = require("../controllers/user/wishlistController");
const walletController=require("../controllers/user/walletController.js")


// router.get("/pageNotFound",userController.pageNotFound)
router.get("/",userController.loadHomePage)
router.get("/shop",userController.loadShoppingPage)


router.get("/signup",  userController.loadSignup)
// router.get("/shop",userController.loadShopping)//because we have to render thats why we give get
router.post("/signup",userController.signup)
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
router.patch("/creditWallet",userAuth,userController.creditWallet)
router.get('/about',userController.loadAboutPage)

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:"/signup"}),(req,res)=>{
    req.session.user = req.user._id
    res.redirect('/')
});


router.get("/login",userController.loadLogin)
router.post("/login",userController.login);  
router.get('/logout',userController.logout)

//productManagemant
router.get("/productDetails",productController.productDetails);
router.get("/shop",productController.loadShopPage)

//userProfileManagement

router.get("/forgot-password", profileController.getForgotPassPage);
router.post("/forgot-email-valid", profileController.forgotEmailValid);
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp);
router.get("/reset-password", profileController.getResetPassPage);
router.post("/resend-forgot-otp", profileController.resendOtp);
// router.post('/resend-forgot-otp', userController.resendForgotOtp);
router.post("/reset-password",profileController.postNewPassword);
router.get("/userProfile",userAuth,profileController.getUserProfile)
// router.post('/update-password', profileController.updatePassword);
// router.get("/userProfile",profileController.getUserProfile)
router.get("/edit-profile",userAuth,profileController.getEditProfilePage)
router.put("/edit-profile",userAuth,profileController.updateUserProfile)
//reset password
router.get("/password-reset",userAuth,profileController.getPasswordResetPage)
router.put("/password-reset",userAuth,profileController.getupdatePassword)
//Address management
router.get('/loadAddresses',userAuth,profileController.loadAddresses)
router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress);
router.get("/editAddress", userAuth, profileController.editAddress);
router.post("/editAddress/:id",userAuth,profileController.postEditAddress)///PENDING
router.delete("/deleteAddress/:id", userAuth, profileController.deleteAddress);

//cart management
router.get("/cart",userAuth,cartController.loadCartPage)
router.post("/cart",userAuth,cartController.postAddToCart)
router.put("/update-cart",userAuth,cartController.updateCartQuantity)
router.delete("/remove-from-cart",userAuth,cartController.removeFromCart)

//checkout
router.get("/check-out",userAuth,cartController.loadCheckOutPage)
router.post("/placeOrder", userAuth, orderController.placeOrder);
router.post('/verifyPayment', userAuth, orderController.verifyPayment);
router.get("/orderList",userAuth,orderController.loadOrderListPage)
router.patch('/cancel-order/:orderId/:itemId', userAuth, orderController.cancelOrder);
router.post('/return-order/:orderId/:itemId', userAuth, orderController.returnOrder);
router.get('/order/:id', userAuth, orderController.loadViewDetailsPage);
router.post("/applyCoupon",userAuth,orderController.applyCoupon)
router.delete("/removeCoupon",userAuth,orderController.removeCoupon)
router.get("/download-invoice/:id",userAuth,orderController.downloadInvoice)
router.post('/retryPayment',userAuth,orderController.retryPayment)
router.patch('/updateOrderStatusOnFailure',userAuth,orderController.updateOrderStatusOnFailure);
router.post("/RequestRefund",userAuth,orderController.walletReturnRefund)

//wishlist managemnet
router.get("/wishlist",userAuth,wishlistController.loadWishlist)
router.patch("/wishlist",userAuth,wishlistController.updateWishlist)

//wallet management
router.get("/wallet",userAuth,walletController.getWalletPage)
router.post("/addFund",userAuth,walletController.addFund)
router.post("/walletPayment",userAuth,walletController.verifyRazorpayPayment)
router.post("/walletRefund",userAuth,walletController.walletRefund)//post
router.post("/deductWallet",userAuth,walletController.deductWalletBalance)
router.post("/verify-referral",userAuth,userController.verifyReferral)
router.get("/failure",userAuth,orderController.paymentFailure)













module.exports=router;