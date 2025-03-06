const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const Order=require("../../models/orderSchema")
const Address=require("../../models/addressSchema")
const fs = require("fs")
const path = require("path");
const sharp = require("sharp");//to resize images
const { log } = require("console");
const mongoose=require('mongoose')


const loadOrderListPage=async(req,res)=>{
    try {
        const status=req.query.status;
        const page=parseInt(req.query.page)||1
        const limit=10


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


// const loadViewDetails = async (req, res) => {
//     try {
//         const orderId = req.params.id;

//         // Validate if orderId is a valid MongoDB ObjectId
//         if (!mongoose.Types.ObjectId.isValid(orderId)) {
//             throw new Error('Invalid order ID');
//         }

//         // Find the order and populate necessary fields
//         const order = await Order.findById(orderId)
//             .populate('user', 'name email phone') // Populate user details
//             .populate({
//                 path: 'orderedItems.product',
//                 select: 'productName productImage price'
//             });

//         if (!order) {
//             throw new Error('Order not found');
//         }

//         res.render('adminViewDetails', {
//             currentPage: 'adminOrderList',
//             order: order
//         });

//     } catch (error) {
//         console.error('Error in loadViewDetails:', error);
//         res.status(500).render('admin/error', {
//             currentPage: 'error',
//             error: error.message || 'Error loading order details'
//         });
//     }
// };


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

// const updateOrderStatus = async (req, res) => {
//     try {
//         const { orderId, status } = req.body;

//         // Validate if orderId is a valid MongoDB ObjectId
//         if (!mongoose.Types.ObjectId.isValid(orderId)) {
//             return res.status(400).json({ 
//                 success: false, 
//                 message: 'Invalid order ID' 
//             });
//         }

//         // Update the order status
//         const updatedOrder = await Order.findByIdAndUpdate(
//             orderId,
//             { status: status },
//             { new: true }
//         );

//         if (!updatedOrder) {
//             return res.status(404).json({ 
//                 success: false, 
//                 message: 'Order not found' 
//             });
//         }

//         res.json({ 
//             success: true, 
//             message: 'Order status updated successfully',
//             order: updatedOrder 
//         });

//     } catch (error) {
//         console.error('Error updating order status:', error);
//         res.status(500).json({ 
//             success: false, 
//             message: 'Failed to update order status' 
//         });
//     }
// };

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

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

        // Add status transition validation
        const validTransitions = {
            'Pending': ['Processing', 'Cancelled'],
            'Processing': ['Shipped', 'Cancelled'],
            'Shipped': ['Delivered'],
            'Delivered': ['Return Request'],
            'Return Request': ['Returned'],
            'Cancelled': [],
            'Returned': []
        };

        if (!validTransitions[order.status].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot change status from ${order.status} to ${status}` 
            });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { status: status },
            { new: true }
        );

        res.json({ 
            success: true, 
            message: 'Order status updated successfully',
            order: updatedOrder 
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update order status' 
        });
    }
};


module.exports={
    loadOrderListPage,
    loadViewDetails,
    updateOrderStatus
  
}