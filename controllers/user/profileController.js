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
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require('../../enum/messages');


function generateOtp(){
    const digits="1234567890";
    let otp="";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)]
    }
    return otp
}


const sendVerificationEmail=async(email,otp)=>{
    try {
        const transporter=nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            }
        })
       
        const mailOptions={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"your OTP for password reset",
            text:`your OTP is ${otp}`,
            html:`<b><h4> your OTP: ${otp}</h4><br></b>`
        }
        const info=await transporter.sendMail(mailOptions)
        console.log("Email sent:",info.messageId);
        return true;
        
        
    } catch (error) {
        console.error("Error sending email",error);
        return false
        

        
    }
}



const forgotEmailValid=async(req,res)=>{
    try {
        const {email}=req.body;
        const findUser=await User.findOne({email:email});
        if(findUser){
            const otp=generateOtp();
            const emailSent=await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp=otp;
                req.session.email=email;
                res.render("forgotPass-otp")
                console.log("OTP:",otp);
                
            }else{
                res.json({success:false,message:Messages.FAILED_OTP});
            }

        }else{
            res.render("forgot-password",{
                message:"User with this email  doesnot exist"
            })
        }
        
    } catch (error) {
        res.redirect("/pageNotFound");

        
    }

}



const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10);
        return passwordHash;
        
    } catch (error) {
        
    }
}


const getForgotPassPage=async(req,res)=>{
    try {
        const user=req.session.user
        const userData=await User.findById(user)
        
        res.render("forgot-password",{
            user:userData

        })
        
        
    } catch (error) {
        next(error)
        
    }
}


const verifyForgotPassOtp = async (req, res) => {
    console.log('--------forgot password OTP verification');
    
    try {
        const enteredOtp = req.body.otp;
        
        if (!req.session.userOtp) {
            return res.json({
                success: false,
                message: "No OTP found. Please request a new verification code."
            });
        }

       
        if (req.session.otpTimestamp) {
            const currentTime = Date.now();
            const otpAge = currentTime - req.session.otpTimestamp;
            const OTP_VALIDITY_DURATION = 60 * 1000; 
            
            if (otpAge > OTP_VALIDITY_DURATION) {
                return res.json({
                    success: false,
                    message: "OTP has expired. Please request a new verification code."
                });
            }
        }
        
        
        if (enteredOtp === req.session.userOtp) {
            req.session.isOtpVerified = true;
            req.session.userOtp = null;
            req.session.otpTimestamp = null;
            
            return res.json({
                success: true,
                message: Messages.OTP_VERIFIED
            });
        } else {
            return res.json({
                success: false,
                message: "Invalid OTP. Please enter the correct verification code."
            });
        }
    } catch (error) {
        console.error("Error in verifyForgotPassOtp:", error);
        return res.json({
            success: false,
            message: Messages.INTERNAL_SERVER_ERROR
        });
    }
};



const getResetPassPage = async(req, res) => {
    try {
        if (!req.session.isOtpVerified || !req.session.email) {
            return res.redirect('/forgot-password');
        }

        res.render("reset-password", { message: '' });
    } catch (error) {
        console.error("Error in getResetPassPage:", error);
        res.redirect("/pageNotFound");
    }
};

const resendOtp = async (req, res) => {
    try {
        console.log('Resend OTP request received');
        console.log('Session data:', req.session);
        
        const otp = generateOtp();
        req.session.userOtp = otp;
        console.log("Generated OTP:", otp); 
        
        const email = req.session.email;
        if (!email) {
            console.error("Error: Email is not found in session");
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.EMAIL_NOT_FOUND });
        }

        console.log("Attempting to resend OTP to email:", email);

        const emailSent = await sendVerificationEmail(email, otp);
        console.log("Email sending result:", emailSent);

        if (emailSent) {
            // console.log("OTP resent successfully",emailSent);
            return res.status(HttpStatus.OK).json({ success: true, message: "OTP sent successfully" });
        } else {
            console.error("Failed to send verification email");
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to send OTP email" });
        }
        

    } catch (error) {
        console.error("Error in resendOtp:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Server Error" });
    }
};



const updatePassword = async(req, res) => {
    try {
        if (!req.session.isOtpVerified || !req.session.email) {
            return res.json({ 
                success: false, 
                message: 'Session expired. Please try again.' 
            });
        }

        const { newPassword } = req.body;
        const email = req.session.email;

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password in database
        await User.findOneAndUpdate(
            { email: email },
            { $set: { password: hashedPassword } }
        );

        // Clear the session data
        req.session.isOtpVerified = false;
        req.session.email = null;
        req.session.userOtp = null;

        res.json({ 
            success: true, 
            message: 'Password updated successfully' 
        });

    } catch (error) {
        console.error('Error in updatePassword:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: 'Failed to update password' 
        });
    }
};

const postNewPassword=async(req,res)=>{
    try {
        const {newPass1,newPass2}=req.body;
        const email=req.session.email;if(newPass1===newPass2){
            const passwordHash=await securePassword(newPass1);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )
            res.redirect("/login");
        }else{
            res.render("reset-password",{message:'passsword donot match'});
        }
    } catch (error) {
        res.redirect("/pageNotFound");
        
    }
}


const getUserProfile = async (req, res) => {
    try {

        if(!req.session.user){
            // console.log("no user in the session")
            res.redirect("/login")          

        }
        const userId=req.session.user


        const userData=await User.findById(userId)
        const addressData=await Address.findOne({userId:userId})
        
        // console.log("..userData",userData);
        
        // console.log("getUserProfile route called");
        return res.render('userProfile',{user:userData,userAddress :addressData}); 
    } catch (error) {
        console.error(error);
        res.redirect("/pageerror");
    }
};

const getEditProfilePage = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }
        
        const isGoogleUser = user.googleId && !user.password;
        
        res.render("edit-profile", { 
            user: user,
            isGoogleUser: isGoogleUser 
        });
        
    } catch (error) {
        console.error("Error loading edit profile page:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render("/pageerror", { message: Messages.INTERNAL_SERVER_ERROR });
    }
}



const updateUserProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const { fullName, phone } = req.body; 
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name: fullName, phone: phone }, // Only update name and phone
            { new: true }
        );
        
        if (!updatedUser) {
            return res.status(HttpStatus.NOT_FOUND).json({success: false, message: "No update found"});
        }
        
        res.json({success: true, message: "Profile updated successfully"});
        
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({success: false, message: Messages.INTERNAL_SERVER_ERROR});
    }
}


const getPasswordResetPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        
        if (!user) { 
            return res.redirect("/login");
        }
        const isGoogleUser = user.googleId && !user.password;
        
        if (isGoogleUser) {
            return res.redirect("/userProfile");
        }
        
        res.render("password-reset", { user: user });
     
    } catch (error) {
        console.error("Error loading password reset page:", error);
        res.redirect("/pageNotFound");
    }
};

const getupdatePassword = async (req, res) => {
    try {
        const userId = req.session.user;
        const { currentPassword, newPassword } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.USER_NOT_FOUND});
        }
        

        const isGoogleUser = user.googleId && !user.password;//block the user from update password
        
        if (isGoogleUser) {
            return res.status(HttpStatus.BAD_REQUEST).json({ 
                success: false, 
                message: 'Password reset is not available for Google OAuth users' 
            });
        }
       
        if (!user.password) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Invalid user credentials' });
        }
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ success: false, message: 'Current password is incorrect' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        user.password = hashedPassword;
        await user.save();
        
        res.status(HttpStatus.OK).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: Messages.INTERNAL_SERVER_ERROR });
    }
};

const loadAddresses=async(req,res)=>{
    try {

        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        const userAddresses = await Address.findOne({ userId: userData._id });


        const addresses = userAddresses ? userAddresses.address : [];
        res.render('adress-list',{addresses})

    } catch (error) {
        console.error("Error loading  address page:", error);
        res.redirect("/pageNotFound");
    }
}

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(401).json({ success: false, message: 'Session expired. Please log in.' });
            }
            return res.redirect('/login');
        }

        const userData = await User.findOne({ _id: userId });
        const userAddresses = await Address.findOne({ userId: userData._id });

        const addresses = userAddresses ? userAddresses.address : [];
        const from = req.query.from || '';

        res.render("add-address", { 
            user: userData, 
            addresses: addresses, 
            from: from 
        });
    } catch (error) {
        console.error("Error loading address list:", error);
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(500).json({ success: false, message: 'Failed to load address page' });
        }
        res.redirect("/pageNotFound");
    }
};

const postAddAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });

        if (!userId || !userData) {
            if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
                return res.status(401).json({ success: false, message: 'User not authenticated. Please log in.' });
            }
            return res.redirect('/login');
        }

        let { addressType, name, city, landMark, state, pincode, phone, altPhone, from } = req.body;

        if (addressType) {
            addressType = addressType.toLowerCase();
        }

        console.log(`Processing address with type: ${addressType} and state: ${state}`);

        let userAddress = await Address.findOne({ userId: userData._id });
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{
                    addressType,
                    name,
                    city,
                    landMark,
                    state,
                    pincode,
                    phone,
                    altPhone
                }]
            });
            await newAddress.save();
        } else {
            userAddress.address.push({
                addressType,
                name,
                city,
                landMark,
                state,
                pincode,
                phone,
                altPhone
            });
            await userAddress.save();
        }

        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            const redirectUrl = from === 'checkout' ? '/check-out' : '/loadAddresses';
            return res.status(200).json({ 
                success: true, 
                message: 'Address added successfully', 
                redirectUrl 
            });
        }

        if (from === 'checkout') {
            return res.redirect('/check-out');
        } else {
            return res.redirect('/loadAddresses');
        }

    } catch (error) {
        console.error('Error adding address:', error);
        if (error.errors) {
            for (let field in error.errors) {
                console.error(`Field ${field}: ${error.errors[field].message}`);
            }
        }
        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(500).json({ success: false, message: 'Failed to add address' });
        }
        return res.redirect("/pageNotFound");
    }
};


const editAddress=async(req,res)=>{
    try {
        const addressId=req.query.id;
        const user=req.session.user;
        const currAddress=await Address.findOne({
            userId:user,
            "address._id":addressId,
        })
        if(!currAddress){
            return res.redirect("/pageNotFound")
        }
        const addressData=currAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString();
        })
        if(!addressData){
            return res.redirect("/pageNotFound")
        }
        res.render("edit-address",{address:addressData,user:user})
        
    } catch (error) {
        console.error("Error in edit address",error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).redirect("/pageNotFound")
        
        
    }
}



const postEditAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.params.id; // Use req.params.id instead of req.query.id
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const userAddress = await Address.findOne({ userId: userId });

        if (!userAddress) {
            return res.status(HttpStatus.NOT_FOUND).redirect("/pageNotFound");
        }

        const addressIndex = userAddress.address.findIndex(
            addr => addr._id.toString() === addressId
        );

        if (addressIndex === -1) {
            return res.status(HttpStatus.NOT_FOUND).redirect("/pageNotFound");
        }

        userAddress.address[addressIndex] = {
            _id: userAddress.address[addressIndex]._id,
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            altPhone
        };

        await userAddress.save();

        res.redirect("/loadAddresses");

    } catch (error) {
        console.error("Error updating address:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).redirect("/pageNotFound");
    }
};
const deleteAddress = async (req, res) => {
    try {
        const { id: addressId } = req.params;
        const userId = req.session.user; // req.session.user contains the user ID directly

        // Check authentication
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated"
            });
        }

        // Validate address ID
        if (!mongoose.Types.ObjectId.isValid(addressId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid address ID"
            });
        }

        // Delete the address
        const result = await Address.updateOne(
            { 
                userId: userId,
                "address._id": addressId 
            },
            { 
                $pull: { 
                    address: { _id: addressId } 
                } 
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Address not found or already deleted"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Address deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting address:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};






module.exports={
    
    forgotEmailValid,
    getUserProfile,
    getForgotPassPage,
    verifyForgotPassOtp,
    sendVerificationEmail,
    getResetPassPage,
    resendOtp,
    getupdatePassword,
    postNewPassword,
    getEditProfilePage,
    updateUserProfile,
    getPasswordResetPage,
    updatePassword,
    loadAddresses,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
}