const Order = require("../../models/orderSchema");
const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const { v4: uuidv4 } = require("uuid");
const Razorpay = require("razorpay");
const dotenv = require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const { Transaction } = require("mongodb");
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require('../../enum/messages');


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });




const getWalletPage = async (req, res) => {
    try {
        if (!req.session.user) {
            // console.log('User not found in session');
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

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5; 
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        const sortedHistory = wallet.walletHistory.sort((a, b) => b.date - a.date);
        const totalTransactions = sortedHistory.length;
        const paginatedHistory = sortedHistory.slice(startIndex, endIndex);

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
        res.status(500).send(Messages.INTERNAL_SERVER_ERROR);
    }
};

const addFund=async(req,res)=>{
    try {
        const{amount,paymentMethod}=req.body;
        const userId=req.session.user

        if(!amount||amount<1){
            return res.status(HttpStatus.BAD_REQUEST).json({success:false,message:Messages.INVALID_AMOUNT})
        }

        if(paymentMethod==='Razorpay'){
            const razorpayOrder=await razorpay.orders.create({
                amount:Math.round(amount*100),
                currency:'INR',
                receipt:'wallet_${userId}_${Date.now()}',
            })
            return res.status(HttpStatus.OK).json({
                success:true,
                razorpayOrderId:razorpayOrder.id,
                amount:Math.round(amount*100),
                razorpayKeyId:process.env.RAZORPAY_KEY_ID
            })
        }
        
    } catch (error) {
        console.error('Error adding funds:', error);
    res.status(500).json({ success: false, message: Messages.INTERNAL_SERVER_ERROR });
        
    }
}

const verifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.body;
        const userId = req.session.user;



        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpayOrderId}|${razorpayPaymentId}`)
            .digest('hex');

        if (expectedSignature !== razorpaySignature) {
            return res.status(400).json({ success: false, message: Messages.INVALID_RAZORPAY_SIGNATURE });
        }

        let user = await User.findById(userId);
        if (!user) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: Messages.INTERNAL_SERVER_ERROR });
        }

     
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({
                userId,
                balance: 0,
                walletHistory: []
            });
        }

        const amountInRupees = parseInt(amount, 10) / 100;//converr paise into rupees   
        if (isNaN(amountInRupees) || amountInRupees <= 0) {//amt is valid number 
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: Messages.INVALID_AMOUNT });
        }

   
        wallet.balance += amountInRupees;

        wallet.walletHistory = wallet.walletHistory || [];
        wallet.walletHistory.push({
            date: new Date(),
            transactionType: 'credit',
            amount: amountInRupees,
            description: 'Wallet Recharge'
        });

      
        await wallet.save();

        return res.status(HttpStatus.OK).json({ success: true, message: Messages.PAYMENT_SUCCESS });

    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({ success: false, message:Messages.INTERNAL_SERVER_ERROR });
    }
}; 

const walletRefund = async (userId, amount, orderId) => {
    try {
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            console.log(`Wallet not found for user ${userId}, creating new wallet`);
            wallet = new Wallet({ userId, balance: 0, walletHistory: [] });
        }
        
        // const oldBalance = wallet.balance;
        wallet.balance += amount;
       
        const transactionId = uuidv4();
        wallet.walletHistory.push({
            transactionId: transactionId,
            transactionType: 'credit',
            amount: amount,
            date: new Date(),
            description: "Refund",
            orderId: orderId
        });
        
        const savedWallet = await wallet.save();
        console.log(`Refund transaction saved - ID: ${transactionId}, New wallet balance: ${savedWallet.balance}`);
        
        return savedWallet;
    } catch (error) {
        // console.error('Error in walletRefund:', error);
        throw new Error(`Failed to process wallet refund: ${error.message}`);
    }
}
const deductWalletBalance = async (userId, amount, orderId) => {
    try {
        
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0, walletHistory: [] });
        }
        
        if (wallet.balance < amount) {
            throw new Error('Insufficient wallet balance');
        }
        console.log("Wallet balance before deduction:", wallet.balance);
        wallet.balance -= amount;
        console.log("Wallet balance after deduction:", wallet.balance);

       
        wallet.walletHistory.push({
            transactionId: uuidv4(),//random unique id
            transactionType: 'debit',
            amount: amount,
            date: new Date(),
            description: 'Purchase',
            orderId: orderId
        });

    
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
    deductWalletBalance


}