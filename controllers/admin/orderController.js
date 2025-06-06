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
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require("../../enum/messages");



const loadOrderListPage=async(req,res)=>{
    try {
        const status=req.query.status;
        const page=parseInt(req.query.page)||1
        const limit=10


      
        let query={}
        if(status){
            query["orderedItems.status"]=status
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
            {$match:{"orderedItems.status":OrderStatus.DELIVERED}},
            {$group:{_id:null,total:{$sum:"$finalAmount"}}}
        ])

        const orderCounts=await Order.aggregate([
            {$unwind:"$orderedItems"},
            {$group:{_id:"$orderedItems.status",count:{$sum:1}}}
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
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render("admin/error", { 
            message: Messages.INTERNAL_SERVER_ERROR
        });
        
    }
}

const loadViewDetails = async (req, res) => {
    try {
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            throw new Error('Invalid order ID');
        }

        const order = await Order.findById(orderId)
            .populate('user', 'name email phone') 
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage price'
            });

        if (!order) {
            throw new Error(Messages.ORDER_NOT_FOUND);
        }

        console.log('Order:', order);
        console.log('Order User:', order.user);

        res.render('adminViewDetails', {
            currentPage: 'adminOrderList',
            order: order
        });

    } catch (error) {
        console.error('Error in loadViewDetails:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('admin/error', {
            currentPage: 'error',
            error: error.message || Messages.INTERNAL_SERVER_ERROR
        });
    }
};

const updateOrderItemStatus = async (req, res) => {
    try {
        const { orderId, itemId, status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(HttpStatus.BAD_REQUEST).json({ 
                success: false, 
                message:Messages.INVALID_ORDER_ID 
            });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).json({ 
                success: false, 
                message: Messages.ORDER_NOT_FOUND
            });
        }

        const itemIndex = order.orderedItems.findIndex(
            item => item._id.toString() === itemId
        );
        if (itemIndex === -1) {
            return res.status(HttpStatus.NOT_FOUND).json({ 
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
            return res.status(HttpStatus.BAD_REQUEST).json({ 
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
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: 'Failed to update item status' 
        });
    }
};

const approveReturn = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            // console.log("Invalid order ID:", orderId);
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: Messages.INVALID_ORDER_ID
            });
        }

        const order = await Order.findById(orderId).populate('orderedItems.product');
        if (!order) {
            console.log("Order not found:", orderId);
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message: Messages.ORDER_NOT_FOUND
            });
        }

//find the product with the statys returned
        const returnRequestedItems = order.orderedItems.filter(item => item.status === OrderStatus.RETURN_REQUEST);
        if (returnRequestedItems.length === 0) {
            console.log("No return requested items found in order:", order.orderId);
            return res.status(HttpStatus.BAD_REQUEST).json({
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

       
            order.orderedItems[itemIndex].status = OrderStatus.RETURNED;
            order.orderedItems[itemIndex].returnApprovalDate = new Date();

          //if the product return then the product stocke is restocked
            if (item.product) {
                await Product.updateOne(
                    { _id: item.product._id },
                    { $inc: { quantity: item.quantity } }
                );
                console.log(`Restocked ${item.quantity} units of product ${item.product._id}`);
            }

            const returnedItemAmount = item.price * item.quantity;
            totalRefundAmount += returnedItemAmount;
            console.log(`Refund amount for item ${item._id}: ₹${returnedItemAmount}`);

            if (
                (order.paymentMethod === "Razorpay" && (order.paymentStatus === "Completed" || order.paymentStatus === "Paid")) ||
                order.paymentMethod === "Wallet"
            ) {
                console.log(`Processing refund of ₹${returnedItemAmount} to wallet for user ${order.user}`);
                try {
                    const userId = order.user.toString(); 
                    const refundResult = await walletReturnRefund(userId, returnedItemAmount, order.orderId);
                } catch (refundError) {
                    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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
 
        const remainingActiveItems = order.orderedItems.filter(
            item => ![OrderStatus.CANCELLED, OrderStatus.RETURNED].includes(item.status)
        ).length;

        console.log(`Remaining active items after return approval: ${remainingActiveItems}`);

        if (remainingActiveItems > 0) {
            order.finalAmount = Math.max(originalFinalAmount - totalRefundAmount, 0);
            console.log(`Partial return - New finalAmount: ${order.finalAmount}`);
        } else {
            order.finalAmount = 0; 
            order.status = OrderStatus.RETURNED;
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
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
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

