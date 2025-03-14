const express=require("express")
const router=express.Router()
const adminController=require("../controllers/admin/adminController")
const customerController=require("../controllers/admin/customerController")
const categoryController=require('../controllers/admin/categoryController')
const brandController=require("../controllers/admin/brandController")
const productController=require("../controllers/admin/productController")
const orderController=require("../controllers/admin/orderController")
const couponController=require("../controllers/admin/couponController")
const {userAuth,adminAuth}=require("../middlewares/auth")
const multer=require("multer")
// const storage=require("../helpers/multer")
// const {uploads,handleMulterError}=multer({storage:storage});
const { upload, handleMulterError } = require("../helpers/multer");


router.get("/pageerror", adminController.pageerror);
 //login management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/dashboard",adminAuth,adminController.loadDashboard)// here we go to the dashboard
router.get("/logout",adminController.logout)

//customer management
router.get("/users",adminAuth,customerController.customerInfo)
router.patch("/blockCustomer", adminAuth, customerController.customerBlocked);
router.patch("/unblockCustomer", adminAuth, customerController.customerUnBlocked);

// router.get("/blockCustomer",customerController.customerBlocked)
// router.get("/unblockCustomer",customerController.customerunBlocked)
//category management
router.get("/category",adminAuth,categoryController.categoryInfo)
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer)
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer)
router.patch("/listCategory", adminAuth, categoryController.getListCategory);    // Unlist (set isListed: false)
router.patch("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory",adminAuth,categoryController.getEditCategory)
router.post("/editCategory/:id",adminAuth,categoryController.editCategory)

//brand management
router.get("/brands",adminAuth,brandController.getBrandPage)
router.patch("/blockBrand", adminAuth, brandController.blockBrand);
router.patch("/unBlockBrand", adminAuth, brandController.unBlockBrand);


//product management
router.get("/addProducts",adminAuth,productController.getProductAddPage);
// router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts)
router.get("/products",adminAuth,productController.getAllProducts);
router.patch("/blockProduct", adminAuth, productController.blockProduct);
router.patch("/unblockProduct", adminAuth, productController.unblockProduct);
router.get("/editProduct",adminAuth,productController.getEditProduct);
// router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct)
router.post("/addProductOffer",adminAuth,productController.addProductOffer)
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer)



router.post("/addBrand", adminAuth, upload.single("image"), handleMulterError, brandController.addBrand);
router.post("/addProducts", adminAuth, upload.array("images", 4), handleMulterError, productController.addProducts);
router.post("/editProduct/:id", adminAuth, upload.array("images", 4), handleMulterError, productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage);
//order Management
router.get("/adminOrderList",adminAuth,orderController.loadOrderListPage)
router.get('/order/:id', adminAuth, orderController.loadViewDetails);
router.post("/order/update-item-status",adminAuth,orderController.updateOrderItemStatus)
router.post("/order/approve-return", adminAuth, orderController.approveReturn);
//coupen Management
router.get("/coupon",adminAuth,couponController.getCouponPage)
router.post("/createCoupon",adminAuth,couponController.createCoupon)
router.post("/deleteCoupon/:couponId", adminAuth, couponController.deleteCoupon);




router.get("/salesReport",adminAuth,adminController.getSalesReport)
// router.post('/admin/order/approve-return',adminAuth, adminController.approveReturnRequest);
// router.get("/admin/salesReport/filter",adminAuth,adminController. getFilteredSalesReport);
// router.get("/AdminDashboard",adminAuth,adminController.getAdminDashboard)

router.all("*", (req, res) => {
    const errorMessage = "The page you are looking for doesn't exist.";
    const errorCode = 404;
    res.render("admin/pageerror", { errorMessage, errorCode });
  });

module.exports= router