const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const Order=require("../../models/orderSchema")
const Address=require("../../models/addressSchema")
const { walletReturnRefund } = require('../user/orderController');

const fs = require("fs")
const path = require("path");
const sharp = require("sharp");//to resize images
const { log } = require("console");
const mongoose=require('mongoose')



const loadOrderListPage=async(req,res)=>{
    try {
        const status=req.query.status;
        const page=parseInt(req.query.page)||1
        const limit=70


        //to building query
        let query={}
        if(status){
            query.status=status
        }

        const totalOrders=await Order.countDocuments(query);
        const totalPages=Math.ceil(totalOrders/limit);

        const orders=await Order.find(query)
            .populate({
                path:"user",
                select:"name email phone"
            })
            .populate({
                path:"orderedItems.product",
                model:"Product",
                select:"productName productImage"

            })
            .sort({createdAt:-1})
            .skip((page-1)*limit)
            .limit(limit)

        const totalRevenue=await Order.aggregate([
            {$match:{status:"Delivered"}},
            {$group:{_id:null,total:{$sum:"$finalAmount"}}}
        ])

        const orderCounts=await Order.aggregate([
            {$group:{_id:"$status",count:{$sum:1}}}
        ]);

        res.render("adminOrderList",{
            orders,
            currentPage:page,
            totalPages,
            totalOrders,
            totalRevenue:totalRevenue[0]?.total||0,
            orderCounts:orderCounts.reduce((acc,curr)=>{
                acc[curr._id]=curr.count;
                return acc;
            },{}),
            selectedStatus:status
        });
        
    } catch (error) {
        console.error("Error loading admin order list:", error);
        res.status(500).render("admin/error", { 
            message: "Failed to load order list" 
        });
        
    }
}

const loadViewDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        // Validate if orderId is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            throw new Error('Invalid order ID');
        }

        // Find the order and populate necessary fields
        const order = await Order.findById(orderId)
            .populate('user', 'name email phone') // Populate user details
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage price'
            });

        if (!order) {
            throw new Error('Order not found');
        }

        // Log for debugging
        console.log('Order:', order);
        console.log('Order User:', order.user);

        res.render('adminViewDetails', {
            currentPage: 'adminOrderList',
            order: order
        });

    } catch (error) {
        console.error('Error in loadViewDetails:', error);
        res.status(500).render('admin/error', {
            currentPage: 'error',
            error: error.message || 'Error loading order details'
        });
    }
};

const updateOrderItemStatus = async (req, res) => {
    try {
        const { orderId, itemId, status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid order ID' 
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        const itemIndex = order.orderedItems.findIndex(
            item => item._id.toString() === itemId
        );
        if (itemIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Item not found' 
            });
        }

        const validTransitions = {
            'Pending': ['Processing', 'Cancelled'],
            'Processing': ['Shipped', 'Cancelled'],
            'Shipped': ['Delivered'],
            'Delivered': ['Return Request'],
            'Return Request': ['Returned'],
            'Cancelled': [],
            'Returned': []
        };

        const currentStatus = order.orderedItems[itemIndex].status;
        if (!validTransitions[currentStatus].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot change status from ${currentStatus} to ${status}` 
            });
        }

        order.orderedItems[itemIndex].status = status;
        await order.save();

        res.json({ 
            success: true, 
            message: 'Item status updated successfully',
            order: order 
        });
    } catch (error) {
        console.error('Error updating item status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update item status' 
        });
    }
};

const approveReturn = async (req, res) => {
    try {
        const { orderId } = req.body;

        console.log(`Starting return approval process for Order: ${orderId}`);

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            console.log("Invalid order ID:", orderId);
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        const order = await Order.findById(orderId).populate('orderedItems.product');
        if (!order) {
            console.log("Order not found:", orderId);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        console.log("Order details:", {
            orderId: order.orderId,
            user: order.user,
            finalAmount: order.finalAmount,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus
        });

        const returnRequestedItems = order.orderedItems.filter(item => item.status === 'Return Request');
        if (returnRequestedItems.length === 0) {
            console.log("No return requested items found in order:", order.orderId);
            return res.status(400).json({
                success: false,
                message: 'No items with return request found in this order'
            });
        }

        const originalFinalAmount = order.finalAmount;
        let totalRefundAmount = 0;

        for (const item of returnRequestedItems) {
            const itemIndex = order.orderedItems.findIndex(i => i._id.toString() === item._id.toString());
            console.log("Processing return for item:", {
                itemId: item._id,
                productName: item.product?.productName,
                price: item.price,
                quantity: item.quantity
            });

            // Update item status to "Returned"
            order.orderedItems[itemIndex].status = 'Returned';
            order.orderedItems[itemIndex].returnApprovalDate = new Date();

            // Restock the product
            if (item.product) {
                await Product.updateOne(
                    { _id: item.product._id },
                    { $inc: { quantity: item.quantity } }
                );
                console.log(`Restocked ${item.quantity} units of product ${item.product._id}`);
            }

            // Calculate refund amount for this item
            const returnedItemAmount = item.price * item.quantity;
            totalRefundAmount += returnedItemAmount;
            console.log(`Refund amount for item ${item._id}: ₹${returnedItemAmount}`);

            // Process refund if payment was made
            if (
                (order.paymentMethod === "Razorpay" && (order.paymentStatus === "Completed" || order.paymentStatus === "Paid")) ||
                order.paymentMethod === "Wallet"
            ) {
                console.log(`Processing refund of ₹${returnedItemAmount} to wallet for user ${order.user}`);
                try {
                    const userId = order.user.toString(); // Ensure userId is a string
                    const refundResult = await walletReturnRefund(userId, returnedItemAmount, order.orderId);
                    console.log(`Refund successful for item ${item._id}:`, refundResult);
                } catch (refundError) {
                    console.error(`Refund failed for item ${item._id}:`, refundError);
                    return res.status(500).json({
                        success: false,
                        message: `Failed to process refund for item ${item._id}`,
                        error: refundError.message
                    });
                }
            } else if (order.paymentMethod === "COD") {
                console.log(`No refund processed for COD item in order ${order.orderId}`);
            } else {
                console.log(`No refund processed - Payment method: ${order.paymentMethod}, Status: ${order.paymentStatus}`);
            }
        }

        // Update order's finalAmount and status
        const remainingActiveItems = order.orderedItems.filter(
            item => !["Cancelled", "Returned"].includes(item.status)
        ).length;

        console.log(`Remaining active items after return approval: ${remainingActiveItems}`);

        if (remainingActiveItems > 0) {
            order.finalAmount = Math.max(originalFinalAmount - totalRefundAmount, 0);
            console.log(`Partial return - New finalAmount: ${order.finalAmount}`);
        } else {
            order.finalAmount = 0; // Full return, set to 0
            order.status = 'Returned';
            console.log(`Full return - New finalAmount: ${order.finalAmount}`);
        }

        await order.save();
        console.log("Order updated successfully:", {
            orderId: order.orderId,
            newFinalAmount: order.finalAmount,
            status: order.status
        });

        res.json({
            success: true,
            message: 'Return approved successfully',
            refundAmount: totalRefundAmount,
            newOrderTotal: order.finalAmount
        });
    } catch (error) {
        console.error('Error approving return:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve return',
            error: error.message
        });
    }
};
module.exports={
    loadOrderListPage,
    loadViewDetails,
    updateOrderItemStatus,
    approveReturn
  
}