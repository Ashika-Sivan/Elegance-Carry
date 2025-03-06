const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const { v4: uuidv4 } = require("uuid");
const Razorpay = require("razorpay");
const dotenv = require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const { Transaction } = require("mongodb");


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });


// const getWalletPage = async (req, res) => {
//     try {
//         // console.log("Session data:", req.session);
//         // console.log("Session user:", req.session.user);
        
       
//         if (!req.session.user) {
//             console.log('User not found in session');
//             return res.redirect('/login');
//         }
        
//         // Correctly handle the ObjectId
//         const userId = req.session.user; // If it's already an ObjectId, use it directly
        
//         let wallet = await Wallet.findOne({ userId });

//         if (!wallet) {
//             wallet = new Wallet({
//                 userId,
//                 balance: 0,
//                 walletHistory: [
//                     {
//                         transactionType: "credit",
//                         amount: 0,
//                         description: "Initial balance"
//                     },
//                 ],
//             });
//             await wallet.save();
//         }
        
//         res.render("wallet", {
//              wallet,
//              user: userId,
//              balance:wallet.balance,
//              walletHistory:wallet.walletHistory

//      });
        
//     } catch (error) {
//         console.error("Error loading wallet page:", error);
//         res.status(500).send("Error loading wallet page. Please try again later.");
//     }
// };

const getWalletPage = async (req, res) => {
    try {
        if (!req.session.user) {
            console.log('User not found in session');
            return res.redirect('/login');
        }
        
        const userId = req.session.user;
        let wallet = await Wallet.findOne({ userId });

        if (!wallet) {
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
        }

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; // Number of transactions per page
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        // Sort transactions by date (newest first)
        const sortedHistory = wallet.walletHistory.sort((a, b) => b.date - a.date);
        const totalTransactions = sortedHistory.length;
        
        // Get paginated transactions
        const paginatedHistory = sortedHistory.slice(startIndex, endIndex);

        // Calculate pagination details
        const totalPages = Math.ceil(totalTransactions / limit);

        res.render("wallet", {
            wallet,
            user: userId,
            balance: wallet.balance,
            walletHistory: paginatedHistory,
            currentPage: page,
            totalPages: totalPages,
            limit: limit,
            totalTransactions: totalTransactions
        });
        
    } catch (error) {
        console.error("Error loading wallet page:", error);
        res.status(500).send("Error loading wallet page. Please try again later.");
    }
};

const addFund=async(req,res)=>{
    try {
        const{amount,paymentMethod}=req.body;
        const userId=req.session.user

        if(!amount||amount<1){
            return res.status(400).json({success:false,message:'Invalid amount'})
        }

        if(paymentMethod==='Razorpay'){
            const razorpayOrder=await razorpay.orders.create({
                amount:Math.round(amount*100),
                currency:'INR',
                receipt:'wallet_${userId}_${Date.now()}',
            })
            return res.status(200).json({
                success:true,
                razorpayOrderId:razorpayOrder.id,
                amount:Math.round(amount*100),
                razorpayKeyId:process.env.RAZORPAY_KEY_ID
            })
        }
        
    } catch (error) {
        console.error('Error adding funds:', error);
    res.status(500).json({ success: false, message: 'Failed to process payment' });
        
    }
}

const verifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.body;
        const userId = req.session.user;


        // Validate Razorpay Signature
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');

        if (expectedSignature !== razorpaySignature) {
            return res.status(400).json({ success: false, message: 'Invalid signature' });
        }

        // Fetch user data
        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Ensure wallet exists for user
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({
                userId,
                balance: 0,
                walletHistory: []
            });
        }

        // Convert amount from paise to rupees
        const amountInRupees = parseInt(amount, 10) / 100;
        if (isNaN(amountInRupees) || amountInRupees <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        // Update wallet balance
        wallet.balance += amountInRupees;

        // Ensure walletHistory exists and push new transaction
        wallet.walletHistory = wallet.walletHistory || [];
        wallet.walletHistory.push({
            date: new Date(),
            transactionType: 'credit',
            amount: amountInRupees,
            description: 'Wallet Recharge'
        });

        // Save updated wallet data
        await wallet.save();

        return res.status(200).json({ success: true, message: 'Payment verified' });

    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({ success: false, message: 'Failed to verify payment' });
    }
};

// const walletRefund=async(userId,amount,description)=>{
//     try {
//         let wallet=await Wallet.findOne({userId});
//         if(!wallet){
//             wallet=new Wallet({userId,balance:0,walletHistory:[]})
//         }
//         wallet.balance+=amount
//         wallet.walletHistory.push({
//             transactionId:uuidv4(),
//             transactionType:'credit',
//             amount:amount,
//             date:new Date(),
//             description:description,
//         })
//         await wallet.save()
//         return wallet;

        
//     } catch (error) {
//         console.error('Error in walletRefund:', error);
//         throw new Error('Failed to process wallet refund');
    
        
//     }
// }

const walletRefund = async (userId, amount, orderId) => {
    try {
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0, walletHistory: [] });
        }
        
        wallet.balance += amount;
        wallet.walletHistory.push({
            transactionId: uuidv4(),
            transactionType: 'credit',
            amount: amount,
            date: new Date(),
            description: "Refund", // Use the predefined enum value
            orderId: orderId // Add the orderId to the wallet history
        });
        
        await wallet.save();
        return wallet;
    } catch (error) {
        console.error('Error in walletRefund:', error);
        throw new Error('Failed to process wallet refund');
    }
}

const deductWalletBalance = async (userId, amount, orderId) => {
    try {
        
        let wallet = await Wallet.findOne({ userId });
        
        
        if (!wallet) {
            throw new Error('Wallet not found');
        }

        
        if (wallet.balance < amount) {
            throw new Error('Insufficient wallet balance');
        }

        wallet.balance -= amount;

       
        wallet.walletHistory.push({
            transactionId: uuidv4(),
            transactionType: 'debit',
            amount: amount,
            date: new Date(),
            description: 'Purchase',
            orderId: orderId
        });

        // Save the updated wallet
        await wallet.save();

        return wallet;
    } catch (error) {
        console.error('Error deducting wallet balance:', error);
        throw error;
    }
};





module.exports={
    getWalletPage,
    addFund,
    verifyRazorpayPayment,
    walletRefund,
    // walletRefund,
    deductWalletBalance


}