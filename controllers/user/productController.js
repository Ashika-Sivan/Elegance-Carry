const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const mongoose = require('mongoose');
const Category=require("../../models/categorySchema")
const Brand=require("../../models/brandSchema");
const WishList = require("../../models/wishlistSchema");
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require('../../enum/messages');

const productDetails = async (req, res) => {
    try {
        const productId = req.query.id;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: Messages.INVALID_PRODUCT_ID });
        }

        const product = await Product.findById(productId).populate('category brand');

        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).json({ message:Messages.PRODUCT_NOT_FOUND });
        }

        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isBlocked: false,
        }).limit(4);


        let userData=null;
        let inWishlist = false;
        if(req.session.user){
            userData=await User.findById(req.session.user)
            const wishlist=await WishList.findOne({userId:req.session.user})
            if(wishlist){
                inWishlist=wishlist.products.some(item=>item.productId.toString()===productId)
            }
        }
        console.log("--------------",product.brand.name);
        
        const category=await Category.find()

        res.render('product-details', {
            product,
            relatedProducts,
            quantity: product.quantity,
            user:userData,
            inWishlist
        });
    } catch (error) {
        next(error)
    }
};



const loadShopPage = async (req, res) => {
    try {
        const userId=req.session.user
     
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        const searchTerm = req.query.search || '';
        const sortType = req.query.sort || 'featured';
        let sortOption = {};

        switch (sortType) {
            case 'priceLowHigh':
                sortOption = { salePrice: 1 };
                break;
            case 'priceHigh':  
                sortOption = { salePrice: -1 };
                break;
            case 'nameAsc':    
                sortOption = { productName: 1 };
                break;
            case 'nameDesc':   
                sortOption = { productName: -1 };
                break;
            case 'balance':
                sortOption = { quantity: -1 };
                break;
            case 'featured':
            default:
                
                sortOption = { createdAt: -1 };
        }

      
        const filterQuery = {};

        if (searchTerm) {
            filterQuery.$or = [
                { productName: { $regex: searchTerm, $options: 'i' } },
                // { description: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        if (req.query.category) {
            filterQuery.category = req.query.category;
        }
        if (req.query.brand) {
            filterQuery.brand = req.query.brand;
        }

        
        if (req.query.minPrice) {
            filterQuery.salePrice = { $gte: parseInt(req.query.minPrice) };
        }
        if (req.query.maxPrice) {
            filterQuery.salePrice = {
                ...(filterQuery.salePrice || {}),
                $lte: parseInt(req.query.maxPrice)
            };
        }

        filterQuery.isBlocked = false;

        const products = await Product.find(filterQuery)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .populate('category')
            .populate('brand');

      

        const totalProducts = await Product.countDocuments(filterQuery);
        const totalPages = Math.ceil(totalProducts / limit);


        const category = await Category.find();
        const brand = await Brand.find();

        const sortLabels = {
            'featured': 'Featured',
            'priceLowHigh': 'Price: Low to High',
            'priceHigh': 'Price: High to Low',
            'nameAsc': 'A to Z',
            'nameDesc': 'Z to A',
            'balance': 'Stock Balance'
        };

        res.render('shop', {
            products,
            category,
            brand,
            currentPage: page,
            totalPages,
            currentSort: sortType,
            sortLabels,
            searchTerm,
            appliedFilters: req.query
        });

    } catch (error) {
        console.error('Error in shop route:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('errorPage', { 
            message:Messages.INTERNAL_SERVER_ERROR
        });
    }
};



module.exports = {
    productDetails,
    loadShopPage,

};


