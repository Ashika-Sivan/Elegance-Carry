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
        //mailoption is whenver the user get the mail after that what it is
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
            //if we find the user we have to gennerate the otp
            const otp=generateOtp();
            const emailSent=await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp=otp;
                req.session.email=email;
                res.render("forgotPass-otp")
                console.log("OTP:",otp);
                
            }else{
                res.json({success:false,message:"Failed to send OTP.please try again"});
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

const verifyForgotPassOtp = async(req, res) => {
    console.log('--------forgot');
    
    try {
        const enteredOtp = req.body.otp;
        
        if (enteredOtp === req.session.userOtp) {
            req.session.isOtpVerified = true;
            res.redirect('/reset-password'); // Direct redirect instead of JSON response
        } else {
            res.render('forgotPass-otp', {
                message: "Invalid OTP. Please try again."
            });
        }
    } catch (error) {
        console.error("Error in verifyForgotPassOtp:", error);
        res.render('forgotPass-otp', {
            message: "An error occurred. Please try again."
        });
    }
};
const getResetPassPage = async(req, res) => {
    try {
        // Check if user has verified OTP
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
        
        const email = req.session.email;
        if (!email) {
            console.error("Error: Email is not found in session");
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        console.log("Attempting to resend OTP to email:", email);

        const emailSent = await sendVerificationEmail(email, otp);
        console.log("Email sending result:", emailSent);

        if (emailSent) {
            console.log("OTP resent successfully");
            return res.status(200).json({ success: true, message: "OTP sent successfully" });
        } else {
            console.error("Failed to send verification email");
            return res.status(500).json({ success: false, message: "Failed to send OTP email" });
        }

    } catch (error) {
        console.error("Error in resendOtp:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// const resendOtp = async (req, res) => {
//     try {
//         console.log('resend---------');
        
//         const otp = generateOtp();
//         req.session.userOtp = otp;
        
//         const email = req.session.email;
//         if (!email) {
//             console.error("Error: Email is not found in session");
//             return res.status(400).json({ success: false, message: "Email not found in session" });
//         }

//         console.log("Resending OTP to email:", email);

//         const emailSent = await sendVerificationEmail(email, otp);

//         if (emailSent) {
//             console.log("Resend OTP successful:", otp);
//             return res.status(200).json({ success: true, message: "Resend OTP Successful" });
//         } else {
//             console.error("Error: Failed to send verification email");
//             return res.status(500).json({ success: false, message: "Failed to send OTP email" });
//         }

//     } catch (error) {
//         console.error("Error in resendOtp:", error);
//         return res.status(500).json({ success: false, message: "Internal Server Error" });
//     }
// };

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
        res.json({ 
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

const getEditProfilePage= async (req, res) => {
    try {
      const userId = req.session.user;
      const user = await User.findById(userId);
      if (!user) {
        return res.redirect('/login'); // Redirect if no user found
      }
        res.render("edit-profile", { user: user });
      
      
    } catch (error) {
      console.error("Error loading edit profile page:", error);
      res.status(500).render("/pageerror", { message: "Internal server error" });
    }
  }


const updateUserProfile=async(req,res)=>{
    try {
        const userId=req.session.user;
        const {fullName,email,phone}=req.body

        const updatedUser=await User.findByIdAndUpdate(
            userId,
            {name:fullName,email,phone},
            {new:true}
        );

        if(!updatedUser){
            return res.status(404).json({success:false,message:"User not found"})
        }
        // res.json({success:true,message:"Profile updated Successfully "})
        res.redirect("/userProfile")
    }catch(error){
        console.error("error updating profile:",error);
        res.status(500).json({success:false,message:"internal server error"})
        

    }
}

const getPasswordResetPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        
        if (!user) { 
            return res.redirect("/login"); // Ensure user is logged in
        }        
        console.log("user in the page", user);
    
        res.render("password-reset", { user: user }); // Pass user data if needed
     
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
            return res.json({ success: false, message: 'User not found' });
        }
        
        // Make sure user.password exists before comparing
        if (!user.password) {
            return res.json({ success: false, message: 'Invalid user credentials' });
        }
        
        // Compare passwords
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: 'Current password is incorrect' });
        }
        
        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update password
        user.password = hashedPassword;
        await user.save();
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error during password reset:', error);
        res.json({ success: false, message: 'An error occurred. Please try again.' });
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
        const userData = await User.findOne({ _id: userId });
        const userAddresses = await Address.findOne({ userId: userData._id });

        const addresses = userAddresses ? userAddresses.address : [];
        
        // Pass the 'from' query parameter to the view
        const from = req.query.from || ''; // Default to empty string if not provided

        res.render("add-address", { user: userData, addresses:addresses ,from:from});

    } catch (error) {
        console.error("Error loading address list:", error);
        res.redirect("/pageNotFound");
    }
};


const postAddAddress = async(req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({_id: userId});
        
        // Get form data
        let {addressType, name, city, landMark, state, pincode, phone, altPhone,from} = req.body;
        
        // Make sure addressType matches exact enum case
        if (addressType) {
            addressType = addressType.toLowerCase();
        }
        
        console.log(`Processing address with type: ${addressType} and state: ${state}`);
        
        const userAddress = await Address.findOne({userId: userData._id});
        if(!userAddress) {
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
        if (from === 'checkout') {
            res.redirect('/check-out');
        } else {
            res.redirect('/loadAddresses');
        }
        
    } catch (error) {
        console.error('Error adding address:', error);
        // Log more details about the error
        if (error.errors) {
            for (let field in error.errors) {
                console.error(`Field ${field}: ${error.errors[field].message}`);
            }
        }
        res.redirect("/pageNotFound");
    }
}

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
        res.redirect("/pageNotFound")
        
        
    }
}

const postEditAddress=async(req,res)=>{
    try {
        const userId=req.session.user
        const addressId=req.query.id
        const {addressType,name,city,landMark,state,pincode,phone,altPhone}=req.body

        const userAddress=await Address.findOne({userId:userId})

        if (!userAddress) {
            return res.redirect("/pageNotFound");
        }
        const addressIndex = userAddress.address.findIndex(
            addr => addr._id.toString() === addressId
        );

        if (addressIndex === -1) {
            return res.redirect("/pageNotFound");
        }

        // Update the existing address instead of pushing a new one
        userAddress.address[addressIndex] = {
            _id: userAddress.address[addressIndex]._id, // Preserve the original _id
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            altPhone
        };

        // Save the updated address
        await userAddress.save();

        res.redirect("/loadAddresses");

    } catch (error) {
        console.error("Error updating address:", error);
        res.redirect("/pageNotFound");
    }
};
    
const deleteAddress=async(req,res)=>{
    try {
        const addressId=req.params.id
        const objectId = new mongoose.Types.ObjectId(addressId);
        const findAddress=await Address.findOne({"address._id":objectId})
        if(!findAddress){

            return res.status(404).send("Address not found")
        }
        await Address.updateOne(
            { "address._id": objectId },
            { $pull: { address: { _id: objectId } } }
        );
        
    res.json({ success: true, message: "Address deleted successfully" });

    } catch (error) {
        console.error("Error delete address",error)
        res.redirect("/pageNotFound")
        
    }
}









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