const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const mongoose=require('mongoose')
const Order=require("../../models/orderSchema")
const Product=require("../../models/productSchema")
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const pageerror = async (req, res) => {

    const errorMessage =
      "An unexpected error occurred while processing your request.";
    const errorCode = 500; // Default error code, can be customized
    res.render("admin/pageerror", { errorMessage, errorCode });
  };

// const pageerror=async(req,res)=>{
//     res.render("admin/pageerror")
// }

const loadLogin = async (req, res) => {
    // console.log('Accessed /admin/login');
    try {
        if (req.session.admin) {
            console.log('Admin is already logged in');
            return res.redirect('/admin/dashboard');
        } else {
            console.log('Rendering admin login page');
            res.render('admin-login', { error: null });
        }
    } catch (error) {
        console.error('Error while loading admin login:', error);
        res.status(500).render('admin-login', { error: 'Internal server error' });
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true;
                return res.redirect('/admin/dashboard'); // Redirect to /admin
            } else {
                return res.render('admin-login', { error: 'Invalid credentials' });
            }
        } else {
            return res.render('admin-login', { error: 'Invalid credentials' });
        }
    } catch (error) {
        console.log('login error', error);
        return res.redirect('/pageerror');
    }
};

const loadDashboard = async (req, res) => {
    
        try {
            if (req.session.admin) {
            res.render('dashboard',{currentPage:"dashboard"});
            }
         else {
            res.redirect('/admin/login');
        }
        } catch (error) {
            res.redirect('/pageerror');
        }
};

const logout=async(req,res)=>{
    try {
       req.session.destroy(err=>{
        if(err){
            console.log("Error destroying session");
            return res.redirect("/pageerror")
            
        }
        res.redirect("/admin/login")
       })
    } catch (error) {
        console.log("unexpected error during logout",error);
        
        res.redirect("/pageerror")
        
    }

}
   





const getSalesReport = async (req, res) => {
    try {
        console.log("Request Query:", req.query);

        const { dateRange, download } = req.query;

        // Define the date filter
        let matchStage = {};
        const now = new Date();

        if (dateRange === "daily") {
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            matchStage = { createdAt: { $gte: startOfDay } };
        } else if (dateRange === "weekly") {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            matchStage = { createdAt: { $gte: oneWeekAgo } };
        } else if (dateRange === "monthly") {
            const oneMonthAgo = new Date();
            oneMonthAgo.setDate(now.getDate() - 30);
            matchStage = { createdAt: { $gte: oneMonthAgo } };
        } else if (dateRange === "yearly") {
            const thisYear = now.getFullYear();
            matchStage = { createdAt: { $gte: new Date(`${thisYear}-01-01`) } };
        } else {
            matchStage = {};
        }

        console.log("Match Stage:", matchStage);

        // Total Revenue
        let totalRevenue = 0;
        try {
            const totalRevenueResult = await Order.aggregate([
                { $match: matchStage },
                { $group: { _id: null, totalRevenue: { $sum: "$finalAmount" } } },
            ]);
            totalRevenue = totalRevenueResult[0]?.totalRevenue || 0;
            console.log("Total Revenue:", totalRevenue);
        } catch (aggError) {
            console.error("Error calculating total revenue:", aggError);
            totalRevenue = 0; // Fallback to 0 if aggregation fails
        }

        // Total Orders
        let totalOrders = 0;
        try {
            totalOrders = await Order.countDocuments(matchStage);
            console.log("Total Orders:", totalOrders);
        } catch (countError) {
            console.error("Error counting orders:", countError);
            totalOrders = 0; // Fallback to 0 if count fails
        }

        // Total Discount
        let totalDiscount = 0;
        try {
            const totalDiscountResult = await Order.aggregate([
                { $match: matchStage },
                { $unwind: "$orderedItems" },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderedItems.product",
                        foreignField: "_id",
                        as: "productDetails",
                    },
                },
                { $unwind: "$productDetails" },
                {
                    $addFields: {
                        effectiveDiscount: {
                            $cond: [
                                { $ifNull: ["$productDetails.salePrice", false] },
                                {
                                    $subtract: [
                                        "$productDetails.regularPrice",
                                        "$productDetails.salePrice",
                                    ],
                                },
                                {
                                    $multiply: [
                                        "$productDetails.regularPrice",
                                        { $divide: ["$productDetails.productOffer", 100] },
                                    ],
                                },
                            ],
                        },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalDiscount: {
                            $sum: {
                                $multiply: ["$orderedItems.quantity", "$effectiveDiscount"],
                            },
                        },
                    },
                },
            ]);
            totalDiscount = totalDiscountResult[0]?.totalDiscount || 0;
            console.log("Total Discount:", totalDiscount);
        } catch (discountError) {
            console.error("Error calculating total discount:", discountError);
            totalDiscount = 0; 
        }

     
        let orders = [];
        try {
            orders = await Order.find(matchStage)
                .populate({
                    path: "user",
                    select: "_id name email",
                })
                .select("orderId createdAt status discount finalAmount")
                .sort({ createdAt: -1 });

            orders = orders.filter(order => order && order.user && order.user._id && order.user.name && order.user.email);
            console.log("Valid Orders:", orders);
        } catch (ordersError) {
            console.error("Error fetching orders:", ordersError);
            orders = [];
        }

        //create pdf file
        if(download){
            // if(download==="pdf"){
            //     const doc=new PDFDocument() ;
            //     res.setHeader('content-type','application/pdf');
            //     res.setHeader('content-disposition','attachment;filename==="sales-report.pdf"')
            //     doc.pipe(res);

            //     doc.fontSize(20).text('Sales Report',{align:'center'});
            //     doc.moveDown();

            //     //summary section
            //     doc.fontSize(14).text('Summary', { underline: true });
            //     doc.fontSize(12)
            //         .text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`)
            //         .text(`Total Orders: ${totalOrders}`)
            //         .text(`Total Discount: ₹${totalDiscount.toFixed(2)}`)
            //         .moveDown();


            //         //order table
            //         if (orders.length > 0) {
            //             doc.fontSize(14).text('Order Details', { underline: true });
            //             doc.moveDown();

            //             //table header
            //             const tableTop = doc.y;
            //         const col1 = 50;
            //         const col2 = 120;
            //         const col3 = 220;
            //         const col4 = 280;
            //         const col5 = 340;
            //         const col6 = 420;

            //         doc.fontSize(10).font('Helvetica-Bold')
            //             .text('Order ID', col1, tableTop)
            //             .text('Customer (User ID)', col2, tableTop)
            //             .text('Date', col3, tableTop)
            //             .text('Status', col4, tableTop)
            //             .text('Discount', col5, tableTop)
            //             .text('Final Amount', col6, tableTop);

            //             // Table Rows
            //         let yPosition = tableTop + 20;
            //         doc.font('Helvetica');
            //         orders.forEach(order => {
            //             if (yPosition > 700) { //to add nwe page when it at the end
            //                 doc.addPage();
            //                 yPosition = 50;
            //             }
            //             doc.text(order.orderId || 'N/A', col1, yPosition)
            //                 .text(`${order.user.name} (${order.user._id})`, col2, yPosition)
            //                 .text(order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A', col3, yPosition)
            //                 .text(order.status || 'N/A', col4, yPosition)
            //                 .text(`₹${order.discount ? order.discount.toFixed(2) : '0.00'}`, col5, yPosition)
            //                 .text(`₹${order.finalAmount ? order.finalAmount.toFixed(2) : '0.00'}`, col6, yPosition);
            //             yPosition += 20;
            //         });

            //         }else {
            //             doc.fontSize(12).text('No orders found for the selected date range.');
            //         }

            //         doc.end();
            //     return;
            // }
                if (download === "pdf") {
                    const doc = new PDFDocument({ margin: 30, size: 'A4' });
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'attachment; filename="sales-report.pdf"');
                    doc.pipe(res);
            
                    // Header
                    doc.font('Helvetica-Bold')
                       .fontSize(20)
                       .fillColor('#2c3e50')
                       .text('Sales Report', { align: 'center' })
                       .moveDown(1);
            
                    // Date Range Info
                    doc.font('Helvetica')
                       .fontSize(12)
                       .fillColor('#666')
                       .text(`Date Range: ${dateRange || 'All Time'}`, { align: 'center' })
                       .moveDown(2);
            
                    // Summary Section
                    doc.font('Helvetica-Bold')
                       .fontSize(14)
                       .fillColor('#2c3e50')
                       .text('Summary', 50, doc.y, { underline: true })
                       .moveDown(0.5);
            
                    doc.font('Helvetica')
                       .fontSize(12)
                       .fillColor('#333')
                       .text(`Total Revenue: ₹${totalRevenue.toFixed(2)}`, 50)
                       .text(`Total Orders: ${totalOrders}`, 50)
                       .text(`Total Discount: ₹${totalDiscount.toFixed(2)}`, 50)
                       .moveDown(1.5);
            
                    // Table Setup
                    if (orders.length > 0) {
                        doc.font('Helvetica-Bold')
                           .fontSize(14)
                           .fillColor('#2c3e50')
                           .text('Order Details', 50, doc.y, { underline: true })
                           .moveDown(1);
            
                        const tableData = {
                            headers: [
                                { label: 'Customer', width: 150 },  // Increased width since we removed Order ID
                                { label: 'Date', width: 100 },
                                { label: 'Status', width: 80 },
                                { label: 'Discount', width: 80, align: 'right' },
                                { label: 'Amount', width: 80, align: 'right' }
                            ],
                            rows: orders.map(order => [
                                order.user.name,  // Only showing customer name, no ID
                                order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
                                order.status || 'N/A',
                                `₹${order.discount ? order.discount.toFixed(2) : '0.00'}`,
                                `₹${order.finalAmount ? order.finalAmount.toFixed(2) : '0.00'}`
                            ])
                        };
            
                        // Draw table manually for better control
                        const startX = 50;
                        let startY = doc.y;
                        const rowHeight = 20;
                        const pageHeight = 700;
            
                        // Draw headers
                        doc.font('Helvetica-Bold')
                           .fontSize(10)
                           .fillColor('#ffffff');
                        
                        let xPos = startX;
                        tableData.headers.forEach((header, i) => {
                            doc.rect(xPos, startY, header.width, rowHeight)
                               .fill('#34495e');
                            doc.text(header.label, xPos + 5, startY + 5, {
                                width: header.width - 10,
                                align: header.align || 'left'
                            });
                            xPos += header.width;
                        });
            
                        // Draw rows
                        doc.font('Helvetica')
                           .fontSize(10)
                           .fillColor('#333');
                        
                        let currentY = startY + rowHeight;
                        tableData.rows.forEach((row, rowIndex) => {
                            if (currentY > pageHeight) {
                                doc.addPage();
                                currentY = 50;
                                // Redraw headers on new page
                                xPos = startX;
                                doc.font('Helvetica-Bold')
                                   .fillColor('#ffffff');
                                tableData.headers.forEach(header => {
                                    doc.rect(xPos, currentY, header.width, rowHeight)
                                       .fill('#34495e');
                                    doc.text(header.label, xPos + 5, currentY + 5, {
                                        width: header.width - 10,
                                        align: header.align || 'left'
                                    });
                                    xPos += header.width;
                                });
                                currentY += rowHeight;
                            }
            
                            xPos = startX;
                            row.forEach((cell, i) => {
                                const bgColor = rowIndex % 2 === 0 ? '#f5f6fa' : '#ffffff';
                                doc.rect(xPos, currentY, tableData.headers[i].width, rowHeight)
                                   .fill(bgColor);
                                doc.fillColor('#333')
                                   .text(cell, xPos + 5, currentY + 5, {
                                       width: tableData.headers[i].width - 10,
                                       align: tableData.headers[i].align || 'left'
                                   });
                                xPos += tableData.headers[i].width;
                            });
                            currentY += rowHeight;
                        });
            
                        // Draw table borders
                        doc.lineWidth(0.5)
                           .strokeColor('#dcdcdc')
                           .rect(startX, startY, 490, currentY - startY)  // Adjusted width due to removed column
                           .stroke();
                    } else {
                        doc.font('Helvetica')
                           .fontSize(12)
                           .fillColor('#666')
                           .text('No orders found for the selected date range.', 50);
                    }
            
                    // Footer
                    doc.moveDown(2)
                       .fontSize(10)
                       .fillColor('#666')
                       .text(`Generated on: ${new Date().toLocaleString()}`, 50, doc.page.height - 50, { align: 'left' })
                       .text('Page ' + doc.pageNumber, 0, doc.page.height - 50, { align: 'right', width: 540 });
            
                    doc.end();
                    return;
                }
            // else if (download === "excel") {
            //     const workbook = new ExcelJS.Workbook();//create new work book
            //     const worksheet = workbook.addWorksheet('Sales Report');
            //     //summary sec
            //     worksheet.addRow(['Sales Report']).font = { size: 16, bold: true };
            //     worksheet.addRow([]); // Empty row
            //     worksheet.addRow(['Summary']).font = { size: 14, bold: true };
            //     worksheet.addRow(['Total Revenue', `₹${totalRevenue.toFixed(2)}`]);
            //     worksheet.addRow(['Total Orders', totalOrders]);
            //     worksheet.addRow(['Total Discount', `₹${totalDiscount.toFixed(2)}`]);
            //     worksheet.addRow([]); //this is also an empty row

            //     //order table
            //     if (orders.length > 0) {
            //         worksheet.addRow(['Order Details']).font = { size: 14, bold: true };

            //         //table rows
            //         orders.forEach(order => {
            //             worksheet.addRow([
            //                 order.orderId || 'N/A',
            //                 `${order.user.name} (${order.user._id})`,
            //                 order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
            //                 order.status || 'N/A',
            //                 `₹${order.discount ? order.discount.toFixed(2) : '0.00'}`,
            //                 `₹${order.finalAmount ? order.finalAmount.toFixed(2) : '0.00'}`
            //             ]);
            //         });
            //         //auto -fit column
            //         worksheet.columns.forEach(column => {
            //             let maxLength = 0;
            //             column.eachCell({ includeEmpty: true }, cell => {
            //                 const columnLength = cell.value ? cell.value.toString().length : 10;
            //                 if (columnLength > maxLength) {
            //                     maxLength = columnLength;
            //                 }
            //             });
            //             column.width = maxLength < 10 ? 10 : maxLength + 2;
            //         });
            //     } else {
            //         worksheet.addRow(['No orders found for the selected date range.']);
            //     }
            //     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            //     res.setHeader('Content-Disposition', 'attachment; filename="sales-report.xlsx"');
            //     await workbook.xlsx.write(res);
            //     res.end();
            //     return;


            // }
            else if (download === "excel") {
                const workbook = new ExcelJS.Workbook(); // Create new workbook
                const worksheet = workbook.addWorksheet('Sales Report');
            
                // Summary section
                worksheet.addRow(['Sales Report']).font = { size: 16, bold: true };
                worksheet.addRow([]); // Empty row
                worksheet.addRow(['Summary']).font = { size: 14, bold: true };
                worksheet.addRow(['Total Revenue', `₹${totalRevenue.toFixed(2)}`]);
                worksheet.addRow(['Total Orders', totalOrders]);
                worksheet.addRow(['Total Discount', `₹${totalDiscount.toFixed(2)}`]);
                worksheet.addRow([]); // Empty row
            
                // Order table
                if (orders.length > 0) {
                    worksheet.addRow(['Order Details']).font = { size: 14, bold: true };
            
                    // Table headers
                    worksheet.addRow([
                        'Customer',
                        'Date',
                        'Status',
                        'Discount',
                        'Amount'
                    ]).font = { bold: true };
            
                    // Table rows
                    orders.forEach(order => {
                        worksheet.addRow([
                            order.user.name, // Only customer name, no user ID
                            order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
                            order.status || 'N/A',
                            `₹${order.discount ? order.discount.toFixed(2) : '0.00'}`,
                            `₹${order.finalAmount ? order.finalAmount.toFixed(2) : '0.00'}`
                        ]);
                    });
            
                    // Auto-fit columns
                    worksheet.columns.forEach(column => {
                        let maxLength = 0;
                        column.eachCell({ includeEmpty: true }, cell => {
                            const columnLength = cell.value ? cell.value.toString().length : 10;
                            if (columnLength > maxLength) {
                                maxLength = columnLength;
                            }
                        });
                        column.width = maxLength < 10 ? 10 : maxLength + 2;
                    });
            
                    // Optional: Add some basic styling
                    worksheet.getRow(1).alignment = { horizontal: 'center' };
                    worksheet.getRow(3).alignment = { horizontal: 'left' };
                    worksheet.getRow(8).font = { bold: true }; // Header row
                    worksheet.columns.forEach((column, i) => {
                        if (i === 3 || i === 4) { // Right-align Discount and Amount columns
                            column.alignment = { horizontal: 'right' };
                        }
                    });
                } else {
                    worksheet.addRow(['No orders found for the selected date range.']);
                }
            
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename="sales-report.xlsx"');
                await workbook.xlsx.write(res);
                res.end();
                return;
            }
        }

        
        res.render("salesReport", {
            currentPage: "salesReport",
            totalRevenue: totalRevenue || 0,
            totalOrders: totalOrders || 0,
            totalDiscount: totalDiscount || 0,
            selectedDateRange: dateRange || "all",
            orders: orders || [],
        });
    } catch (error) {
        console.error("Failed to generate sales report:", error);
        const errorMessage = "An unexpected error occurred while generating the sales report.";
        const errorCode = 500;
        res.status(500).render("admin/pageerror", { errorMessage, errorCode });
    }
};

const approveReturnRequest=async(req,res)=>{
    try {
        const {orderId}=req.body
        if(!mongoose.Types.ObjectId.isValid(orderId)){
            return res.status(400).json({
                success:false,
                message:'Invalid Order ID'
            })
        }

        const order=await Order.findById(orderId).populate('orderedItems.product')
        if(!order){
            return res.status(404).json({
                success:false,
                message:'Order not Found'
            })
        }
        if(order.status!=='Return Request'){
            return res.status(400).json({
                success:false,
                message:'Order is not in return Request Status',

            });
        }
        for(const item of order.orderedItems){
            await Product.updateOne(
                {_id:item.product._id},
                {$inc:{quantity:item.quantity}} //it is toi increment the quantity
            )
        }

        //refund
        const user=await User.findById(order.user);
        if(!user){
            return res.status(404).json({
                success:false,
                messsage:"user not found"
            })
        }
        user.walletBalance+=order.finalAmount
        await user.save();
        const updatedOrder=await Order.findByIdAndUpdate(
            orderId,
            {
                status:'Returned',
                returnApprovalDate:new Date()
            },
            {new:true}
        )
        res.jsonn({
            success:true,
            message:'Return request approved ,stock updated,and amount refunded successfully',
            order:updatedOrder
        })
    } catch (error) {
        console.error('Error approving return request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve return request',
        });
        
    }
}




module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    getSalesReport,
    approveReturnRequest
    // getFilteredSalesReport
   
}
