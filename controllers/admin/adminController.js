const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const mongoose=require('mongoose')
const Order=require("../../models/orderSchema")
const Product=require("../../models/productSchema")
const Category=require("../../models/categorySchema")
const Brand=require("../../models/brandSchema")
const { walletReturnRefund } = require('../user/orderController');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require('../../enum/messages');

const pageerror = async (req, res) => {

    const errorMessage =
      "An unexpected error occurred while processing your request.";
    const errorCode = 500; 
    res.render("admin/pageerror", { errorMessage, errorCode });
  };



const loadLogin = async (req, res) => {
    console.log('Accessed /admin/login');
    try {
        if (req.session.admin) {
            console.log('Admin is already logged in');
            return res.redirect('/admin/dashboard');
        } else {
           
            res.render('admin-login', { error: null });
        }
    } catch (error) {
        console.error('Error while loading admin login:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('admin-login', { error: Messages.INTERNAL_SERVER_ERROR});
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
                return res.redirect('/admin/dashboard'); 
            } else {
                return res.render('admin-login', { error: Messages.INVALID_CREDENTIALS });
            }
        } else {
            return res.render('admin-login', { error: Messages.INVALID_CREDENTIALS });
        }
    } catch (error) {
        console.log('login error', error);
        return res.redirect('/pageerror');
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

        const { dateRange, startDate, endDate, download, page = 1 } = req.query;
        const limit = 10; 
        const currentPage = parseInt(page, 10) || 1;
        const skip = (currentPage - 1) * limit;

        if (isNaN(currentPage) || currentPage < 1) {
            throw new Error("Invalid page number");
        }

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
        } else if (dateRange === "custom" && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
                throw new Error("Invalid date range");
            }
            matchStage = {
                createdAt: {
                    $gte: start,
                    $lte: end
                }
            };
        } else {
            matchStage = {};
        }

        // console.log("Match Stage:", matchStage);

        let totalRevenue = 0;
        try {
            const totalRevenueResult = await Order.aggregate([
                { $match: matchStage },
                { $group: { _id: null, totalRevenue: { $sum: { $ifNull: ["$finalAmount", 0] } } } },
            ]);
            totalRevenue = totalRevenueResult[0]?.totalRevenue || 0;
        } catch (aggError) {
            console.error("Error calculating total revenue:", aggError.message, aggError.stack);
            totalRevenue = 0;
        }

        let totalOrders = 0;
        try {
            totalOrders = await Order.countDocuments(matchStage);
            console.log("Total Orders:", totalOrders);
        } catch (countError) {
            console.error("Error counting orders:", countError.message, countError.stack);
            totalOrders = 0;
        }

        let totalDiscount = 0;
        try {
            const totalDiscountResult = await Order.aggregate([
                { $match: matchStage },
                { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: "products",
                        localField: "orderedItems.product",
                        foreignField: "_id",
                        as: "productDetails",
                    },
                },
                { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        effectiveDiscount: {
                            $cond: [
                                { $and: [
                                    { $ifNull: ["$productDetails.salePrice", false] },
                                    { $ifNull: ["$productDetails.regularPrice", false] }
                                ] },
                                {
                                    $subtract: [
                                        { $ifNull: ["$productDetails.regularPrice", 0] },
                                        { $ifNull: ["$productDetails.salePrice", 0] },
                                    ],
                                },
                                {
                                    $cond: [
                                        { $and: [
                                            { $ifNull: ["$productDetails.productOffer", false] },
                                            { $ifNull: ["$productDetails.regularPrice", false] }
                                        ] },
                                        {
                                            $multiply: [
                                                { $ifNull: ["$productDetails.regularPrice", 0] },
                                                { $divide: [{ $ifNull: ["$productDetails.productOffer", 0] }, 100] },
                                            ],
                                        },
                                        0
                                    ]
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
                                $multiply: [
                                    { $ifNull: ["$orderedItems.quantity", 0] },
                                    { $ifNull: ["$effectiveDiscount", 0] }
                                ],
                            },
                        },
                    },
                },
            ]);
            totalDiscount = totalDiscountResult[0]?.totalDiscount || 0;
        } catch (discountError) {
            console.error("Error calculating total discount:", discountError.message, discountError.stack);
            totalDiscount = 0;
        }

        let orders = [];
        try {
            matchStage.user = { $exists: true, $ne: null };
            const ordersWithValidUsers = await Order.find(matchStage)
                .select("user")
                .lean();
            const validUserIds = ordersWithValidUsers
                .filter(order => order.user && mongoose.Types.ObjectId.isValid(order.user))
                .map(order => order.user);

            if (validUserIds.length === 0) {
                console.log("No orders with valid user references found.");
                orders = [];
            } else {
                matchStage.user = { $in: validUserIds };

                if (download) {
                    orders = await Order.find(matchStage)
                        .populate({
                            path: "user",
                            select: "_id name email",
                            match: { _id: { $exists: true }, name: { $exists: true }, email: { $exists: true } }
                        })
                        .select("orderId createdAt status discount finalAmount paymentMethod")
                        .sort({ createdAt: -1 });
                } else {
                    orders = await Order.find(matchStage)
                        .populate({
                            path: "user",
                            select: "_id name email",
                            match: { _id: { $exists: true }, name: { $exists: true }, email: { $exists: true } }
                        })
                        .select("orderId createdAt status discount finalAmount paymentMethod")
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limit);
                }

                orders = orders.filter(order => order && order.user && order.user._id && order.user.name && order.user.email);
             
            }
        } catch (ordersError) {
            console.error("Error fetching orders:", ordersError.message, ordersError.stack);
            orders = [];
        }

        const totalPages = Math.ceil(totalOrders / limit);


        if (download) {
            if (download === "pdf") {
                const doc = new PDFDocument({ margin: 30, size: 'A4' });
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename="sales-report.pdf"');
                doc.pipe(res);

                doc.on('pageAdded', () => {
                    doc.save()
                        .font('Helvetica-Bold')
                        .fontSize(16)
                        .fillColor('#2c3e50')
                        .text('Elagance Carry', 50, 20, { align: 'left' })
                        .font('Helvetica')
                        .fontSize(10)
                        .fillColor('#333')
                        .text('Phone: 9638527415', 50, 38, { align: 'left' })
                        .text('Country: India', 50, 52, { align: 'left' })
                        .fillColor('#666')
                        .text(`Date Range: ${dateRange === 'custom' ? `${startDate} to ${endDate}` : (dateRange || 'All Time')}`, 400, 38, { align: 'right' })
                        .lineWidth(0.5)
                        .strokeColor('#dcdcdc')
                        .moveTo(50, 65)
                        .lineTo(540, 65)
                        .stroke()
                        .restore();
                });

                doc.moveDown(4);
                doc.font('Helvetica-Bold')
                    .fontSize(20)
                    .fillColor('#2c3e50')
                    .text('Elagance Carry', { align: 'center' })
                    .moveDown(0.5);
                doc.font('Helvetica-Bold')
                    .fontSize(12)
                    .fillColor('#2c3e20')
                    .text('Where Every Bag Tells a Story.', { align: 'center' })
                    .text('Sales Report', { align: 'center' })
                    .moveDown(0.5);

                doc.font('Helvetica')
                    .fontSize(12)
                    .fillColor('#666')
                    .text(`Date Range: ${dateRange === 'custom' ? `${startDate} to ${endDate}` : (dateRange || 'All Time')}`, { align: 'center' })
                    .moveDown(2);

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

                if (orders.length > 0) {
                    doc.font('Helvetica-Bold')
                        .fontSize(14)
                        .fillColor('#2c3e50')
                        .text('Order Details', 50, doc.y, { underline: true })
                        .moveDown(1);

                    const tableData = {
                        headers: [
                            { label: 'Customer', width: 110 },
                            { label: 'Date', width: 80 },
                            { label: 'Status', width: 70 },
                            { label: 'Discount', width: 70, align: 'right' },
                            { label: 'Amount', width: 70, align: 'right' },
                            { label: 'Payment', width: 90 }
                        ],
                        rows: orders.map(order => [
                            order.user.name || 'N/A',
                            order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
                            order.status || 'N/A',
                            `₹${order.discount ? order.discount.toFixed(2) : '0.00'}`,
                            `₹${order.finalAmount ? order.finalAmount.toFixed(2) : '0.00'}`,
                            order.paymentMethod || 'N/A'
                        ])
                    };

                    const startX = 50;
                    let startY = doc.y;
                    const rowHeight = 20;
                    const pageHeight = 700;

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

                    doc.font('Helvetica')
                        .fontSize(10)
                        .fillColor('#333');

                    let currentY = startY + rowHeight;
                    tableData.rows.forEach((row, rowIndex) => {
                        if (currentY > pageHeight) {
                            doc.addPage();
                            currentY = 80;
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

                    doc.lineWidth(0.5)
                        .strokeColor('#dcdcdc')
                        .rect(startX, startY, 490, currentY - startY)
                        .stroke();

                    doc.moveDown(2);
                    doc.font('Helvetica-Bold')
                        .fontSize(14)
                        .fillColor('#2c3e50')
                        .text('Payment Method Summary', 50, doc.y, { underline: true })
                        .moveDown(1);

                    const paymentMethodTotals = {};
                    orders.forEach(order => {
                        const method = order.paymentMethod || 'Unknown';
                        if (!paymentMethodTotals[method]) {
                            paymentMethodTotals[method] = 0;
                        }
                        paymentMethodTotals[method] += order.finalAmount || 0;
                    });

                    const pmTableTop = doc.y;
                    const pmCol1 = 150;
                    const pmCol2 = 300;

                    doc.font('Helvetica-Bold')
                        .fontSize(10)
                        .fillColor('#ffffff')
                        .rect(pmCol1, pmTableTop, 150, rowHeight).fill('#34495e')
                        .rect(pmCol2, pmTableTop, 100, rowHeight).fill('#34495e')
                        .text('Payment Method', pmCol1 + 5, pmTableTop + 5)
                        .text('Total Amount', pmCol2 + 5, pmTableTop + 5);

                    let pmY = pmTableTop + rowHeight;

                    if (pmY + (Object.keys(paymentMethodTotals).length * rowHeight) > pageHeight) {
                        doc.addPage();
                        pmY = 80;
                        doc.font('Helvetica-Bold')
                            .fontSize(14)
                            .fillColor('#2c3e50')
                            .text('Payment Method Summary', 50, pmY, { underline: true })
                            .moveDown(1);

                        pmY = doc.y;
                        doc.font('Helvetica-Bold')
                            .fontSize(10)
                            .fillColor('#ffffff')
                            .rect(pmCol1, pmY, 150, rowHeight).fill('#34495e')
                            .rect(pmCol2, pmY, 100, rowHeight).fill('#34495e')
                            .text('Payment Method', pmCol1 + 5, pmY + 5)
                            .text('Total Amount', pmCol2 + 5, pmY + 5);

                        pmY += rowHeight;
                    }

                    doc.font('Helvetica')
                        .fontSize(10)
                        .fillColor('#333');

                    Object.entries(paymentMethodTotals).forEach(([method, amount], index) => {
                        const bgColor = index % 2 === 0 ? '#f5f6fa' : '#ffffff';
                        doc.rect(pmCol1, pmY, 150, rowHeight).fill(bgColor)
                            .rect(pmCol2, pmY, 100, rowHeight).fill(bgColor)
                            .text(method, pmCol1 + 5, pmY + 5)
                            .text(`₹${amount.toFixed(2)}`, pmCol2 + 5, pmY + 5);
                        pmY += rowHeight;
                    });

                    doc.lineWidth(0.5)
                        .strokeColor('#dcdcdc')
                        .rect(pmCol1, pmTableTop, 150, pmY - pmTableTop)
                        .rect(pmCol2, pmTableTop, 100, pmY - pmTableTop)
                        .stroke();
                } else {
                    doc.font('Helvetica')
                        .fontSize(12)
                        .fillColor('#666')
                        .text('No orders found for the selected date range.', 50);
                }

                doc.moveDown(2)
                    .fontSize(10)
                    .fillColor('#666')
                    .text(`Generated on: ${new Date().toLocaleString()}`, 50, doc.page.height - 50, { align: 'left' })
                    .text('Page ' + doc.pageNumber, 0, doc.page.height - 50, { align: 'right', width: 540 });

                doc.end();
                return;
            } else if (download === "excel") {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Sales Report');

                worksheet.addRow(['Sales Report']).font = { size: 16, bold: true };
                worksheet.addRow([]);
                worksheet.addRow(['Summary']).font = { size: 14, bold: true };
                worksheet.addRow(['Total Revenue', `₹${totalRevenue.toFixed(2)}`]);
                worksheet.addRow(['Total Orders', totalOrders]);
                worksheet.addRow(['Total Discount', `₹${totalDiscount.toFixed(2)}`]);
                worksheet.addRow([]);

                if (orders.length > 0) {
                    worksheet.addRow(['Order Details']).font = { size: 14, bold: true };

                    const headerRow = worksheet.addRow([
                        'Customer',
                        'Date',
                        'Status',
                        'Discount',
                        'Amount',
                        'Payment Method'
                    ]);
                    headerRow.font = { bold: true };

                    orders.forEach(order => {
                        worksheet.addRow([
                            order.user.name || 'N/A',
                            order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
                            order.status || 'N/A',
                            `₹${order.discount ? order.discount.toFixed(2) : '0.00'}`,
                            `₹${order.finalAmount ? order.finalAmount.toFixed(2) : '0.00'}`,
                            order.paymentMethod || 'N/A'
                        ]);
                    });

                    worksheet.addRow([]);
                    worksheet.addRow(['Payment Method Summary']).font = { size: 14, bold: true };

                    const paymentMethodTotals = {};
                    orders.forEach(order => {
                        const method = order.paymentMethod || 'Unknown';
                        if (!paymentMethodTotals[method]) {
                            paymentMethodTotals[method] = 0;
                        }
                        paymentMethodTotals[method] += order.finalAmount || 0;
                    });

                    worksheet.addRow(['Payment Method', 'Total Amount']).font = { bold: true };
                    Object.entries(paymentMethodTotals).forEach(([method, amount]) => {
                        worksheet.addRow([method, `₹${amount.toFixed(2)}`]);
                    });

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

                    worksheet.getRow(1).alignment = { horizontal: 'center' };
                    worksheet.getRow(3).alignment = { horizontal: 'left' };
                    worksheet.getRow(8).font = { bold: true };
                    worksheet.columns.forEach((column, i) => {
                        if (i === 3 || i === 4) {
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

        console.log("Rendering salesReport with data:", {
            totalRevenue,
            totalOrders,
            totalDiscount,
            selectedDateRange: dateRange || "all",
            startDate: startDate || "",
            endDate: endDate || "",
            ordersCount: orders.length,
            currentPage,
            totalPages
        });

        res.render("salesReport", {
            currentPage: "salesReport",
            totalRevenue: totalRevenue || 0,
            totalOrders: totalOrders || 0,
            totalDiscount: totalDiscount || 0,
            selectedDateRange: dateRange || "all",
            startDate: startDate || "",
            endDate: endDate || "",
            orders: orders || [],
            currentPage: currentPage,
            totalPages: totalPages,
            limit: limit
        });
    } catch (error) {
        console.error("Failed to generate sales report:", error.message, error.stack);
        const errorMessage = `An unexpected error occurred while generating the sales report: ${error.message}`;
        const errorCode = 500;
        res.status(500).render("admin/pageerror", { errorMessage, errorCode });
    }
};
const loadDashboard = async (req, res) => {
    try {
        const { filterValue, startDate, endDate } = req.query;
        const today = new Date();
        let dayStart, dayEnd;


        const validateCustomDates = (start, end) => {
            const startD = new Date(start);
            const endD = new Date(end);
            const now = new Date();

            if (isNaN(startD.getTime()) || isNaN(endD.getTime())) {
                return { isValid: false, message: "Invalid date format" };
            }

            if (startD > now) {
                return { isValid: false, message: "Start date cannot be in the future" };
            }

            if (endD > now) {
                return { isValid: false, message: "End date cannot be in the future" };
            }

            if (startD > endD) {
                return { isValid: false, message: "Start date must be before end date" };
            }

            const diffTime = endD - startD;
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            if (diffDays > 365) {
                return { isValid: false, message: "Date range cannot exceed 1 year" };
            }

            return { isValid: true };
        };

        
        switch (filterValue) {
            case 'daily':
                dayStart = new Date(today.setHours(0, 0, 0, 0));
                dayEnd = new Date(today.setHours(23, 59, 59, 999));
                break;
            case 'weekly':
                const firstDayOfWeek = today.getDate() - today.getDay();
                dayStart = new Date(today.getFullYear(), today.getMonth(), firstDayOfWeek);
                dayStart.setHours(0, 0, 0, 0);
                dayEnd = new Date(today.getFullYear(), today.getMonth(), firstDayOfWeek + 6);
                dayEnd.setHours(23, 59, 59, 999);
                break;
            case 'monthly':
                dayStart = new Date(today.getFullYear(), today.getMonth(), 1);
                dayStart.setHours(0, 0, 0, 0);
                dayEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                dayEnd.setHours(23, 59, 59, 999);
                break;
            case 'yearly':
                dayStart = new Date(today.getFullYear(), 0, 1);
                dayStart.setHours(0, 0, 0, 0);
                dayEnd = new Date(today.getFullYear(), 11, 31);
                dayEnd.setHours(23, 59, 59, 999);
                break;
            case 'custom':
                if (startDate && endDate) {
                    dayStart = new Date(startDate);
                    dayEnd = new Date(endDate);
                    dayEnd.setHours(23, 59, 59, 999);
                }
                break;
            default:
                dayStart = new Date(0);
                dayEnd = new Date();
        }

        //top 10 prod
        const topProducts = await Product.aggregate([
            {
                $match: { isBlocked: false }
            },
            {
                $lookup: {
                    from: "orders",
                    localField: "_id",
                    foreignField: "orderedItems.product",
                    as: "orders"
                }
            },
            { $unwind: "$orders" },
            { $unwind: "$orders.orderedItems" },
            {
                $match: {
                    $expr: { $eq: ["$_id", "$orders.orderedItems.product"] },
                    "orders.status": { $nin: [OrderStatus.CANCELLED, OrderStatus.RETURNED, OrderStatus.RETURN_REQUEST] },
                    "orders.createdAt": { $gte: dayStart, $lte: dayEnd }
                }
            },
            {
                $group: {
                    _id: "$_id",
                    productName: { $first: "$productName" },
                    productImage: { $first: "$productImage" },
                    totalQuantity: { $sum: "$orders.orderedItems.quantity" },
                    totalRevenue: {
                        $sum: {
                            $multiply: [
                                "$orders.orderedItems.quantity",
                                "$orders.orderedItems.price"
                            ]
                        }
                    }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
            {
                $project: {
                    _id: 1,
                    productName: 1,
                    productImage: 1,
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            }
        ]);

        // Top 10 brands
        const topBrand = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: "brands",
                    localField: "productDetails.brand",
                    foreignField: "_id",
                    as: "brandDetails"
                }
            },
            { $unwind: "$brandDetails" },
            {
                $match: {
                    "productDetails.isBlocked": false,
                    "brandDetails.isBlocked": false,
                    "status": { $nin: [OrderStatus.CANCELLED, OrderStatus.RETURNED, OrderStatus.RETURN_REQUEST] },
                    "createdAt": { $gte: dayStart, $lte: dayEnd }
                }
            },
            {
                $group: {
                    _id: {
                        brandId: "$brandDetails._id",
                        orderId: "$_id"
                    },
                    brandName: { $first: "$brandDetails.name" },
                    totalSales: {
                        $sum: {
                            $multiply: ["$orderedItems.quantity", "$orderedItems.price"]
                        }
                    },
                    totalQuantity: { $sum: "$orderedItems.quantity" }
                }
            },
            {
                $group: {
                    _id: "$_id.brandId",
                    brandName: { $first: "$brandName" },
                    totalSales: { $sum: "$totalSales" },
                    totalQuantity: { $sum: "$totalQuantity" },
                    totalOrders: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    averageOrderValue: { $divide: ["$totalSales", "$totalOrders"] }
                }
            },
            { $sort: { totalSales: -1 } },
            { $limit: 10 }
        ]);

        const topCategories = await Order.aggregate([
            {
                $match: {
                    status: { $nin: [OrderStatus.CANCELLED, OrderStatus.RETURNED, OrderStatus.RETURN_REQUEST] },
                    createdAt: { $gte: dayStart, $lte: dayEnd }
                }
            },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $lookup: {
                    from: "categories",
                    localField: "product.category",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $match: {
                    "category.isListed": true,
                    "product.isBlocked": false
                }
            },
            {
                $group: {
                    _id: "$category._id",
                    categoryName: { $first: "$category.name" },
                    totalOrders: { $sum: 1 },
                    totalQuantitySold: { $sum: "$orderedItems.quantity" },
                    totalRevenue: {
                        $sum: {
                            $multiply: ["$orderedItems.price", "$orderedItems.quantity"]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    categoryName: 1,
                    totalOrders: 1,
                    totalQuantitySold: 1,
                    totalRevenue: { $round: ["$totalRevenue", 2] },
                    averageOrderValue: {
                        $round: [{ $divide: ["$totalRevenue", "$totalOrders"] }, 2]
                    }
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 }
        ]);

       
        const totalRevenue = await Order.aggregate([
            {
                $match: {
                    status: { $nin: [OrderStatus.CANCELLED, OrderStatus.RETURNED, OrderStatus.RETURN_REQUEST] },
                    createdAt: { $gte: dayStart, $lte: dayEnd }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$finalAmount" }
                }
            }
        ]);

        const totalOrders = await Order.countDocuments({
            status: { $nin: [OrderStatus.CANCELLED, OrderStatus.RETURNED, OrderStatus.RETURN_REQUEST] },
            createdAt: { $gte: dayStart, $lte: dayEnd }
        });

        const totalCustomers = await User.countDocuments({
            isAdmin: false,
            createdAt: { $gte: dayStart, $lte: dayEnd }
        });

       
        let groupByStage;
        let labelFormat;

        switch (filterValue) {
            case 'daily':
                
                groupByStage = {
                    $group: {
                        _id: { $hour: "$createdAt" },
                        totalRevenue: { $sum: "$finalAmount" }
                    }
                };
                labelFormat = (hour) => `Hour ${hour}`;
                break;
            case 'weekly':
            
                groupByStage = {
                    $group: {
                        _id: { $dayOfWeek: "$createdAt" },
                        totalRevenue: { $sum: "$finalAmount" }
                    }
                };
                labelFormat = (day) => {
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    return days[day - 1];
                };
                break;
            case 'monthly':
                
                groupByStage = {
                    $group: {
                        _id: { $dayOfMonth: "$createdAt" },
                        totalRevenue: { $sum: "$finalAmount" }
                    }
                };
                labelFormat = (day) => `Day ${day}`;
                break;
            case 'yearly':
                
                groupByStage = {
                    $group: {
                        _id: { $month: "$createdAt" },
                        totalRevenue: { $sum: "$finalAmount" }
                    }
                };
                labelFormat = (month) => {
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    return months[month - 1];
                };
                break;
            case 'custom':
              
                groupByStage = {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        totalRevenue: { $sum: "$finalAmount" }
                    }
                };
                labelFormat = (date) => date;
                break;
            default:
              
                groupByStage = {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                        totalRevenue: { $sum: "$finalAmount" }
                    }
                };
                labelFormat = (date) => date;
        }

        const revenueTrend = await Order.aggregate([
            {
                $match: {
                    status: { $nin: [OrderStatus.CANCELLED, OrderStatus.RETURNED, OrderStatus.RETURN_REQUEST] },
                    createdAt: { $gte: dayStart, $lte: dayEnd }
                }
            },
            groupByStage,
            { $sort: { "_id": 1 } }
        ]);

        const chartLabels = revenueTrend.map(item => labelFormat(item._id));
        const chartData = revenueTrend.map(item => item.totalRevenue);

        return res.render("dashboard", {
            topProducts: topProducts || [],
            topBrand: topBrand || [],
            topCategories: topCategories || [],
            totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
            totalOrders,
            totalCustomers,
            selectedFilter: filterValue || 'all',
            startDate: startDate ? new Date(startDate).toISOString().split('T')[0] : '',
            endDate: endDate ? new Date(endDate).toISOString().split('T')[0] : '',
            chartLabels: chartLabels || [],
            chartData: chartData || []
        });
    } catch (error) {
        console.error('Error in dashboard analytics:', error);
        throw error;
    }
};



module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    getSalesReport,
   
}
