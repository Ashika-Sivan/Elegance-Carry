const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const mongoose = require('mongoose');
const Category=require("../../models/categorySchema")
const Brand=require("../../models/brandSchema")

const productDetails = async (req, res) => {
    try {
        const productId = req.query.id;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid product ID' });
        }

        const product = await Product.findById(productId).populate('category brand');

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id },
            isBlocked: false,
        }).limit(4);
        // console.log('found relatec products:',relatedProducts);
        

        let userData=null;
        if(req.session.user){
            userData=await User.findById(req.session.user)
        }

        console.log("--------------",product.brand.name);
        
        const category=await Category.find()

        res.render('product-details', {
            product,
            relatedProducts,
            quantity: product.quantity,
            user:userData,
            
            

        });
    } catch (error) {
        // console.error('Error fetching product details:', error.message);
        next(error)
    }
};


// const loadShopPage = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = 12;
//         const skip = (page - 1) * limit;

//         const sortType = req.query.sort || 'featured';
//         let sortOption = {};
//         switch (sortType) {
//             case 'priceLowHigh':
//                 sortOption = { salePrice: 1 };
//                 break;
//             case 'priceHighLow':
//                 sortOption = { salePrice: -1 };
//                 break;
//             case 'aToZ':
//                 sortOption = { productName: 1 };
//                 break;
//             case 'zToA':
//                 sortOption = { productName: -1 };
//                 break;
//             case 'balance':
//                 sortOption = { quantity: -1 };
//                 break;
//             case 'featured':
//             default:
//                 sortOption = {};
//         }

//         const filterQuery = {};
//         if (req.query.category) {
//             filterQuery.category = req.query.category;
//         }
//         if (req.query.brand) {
//             filterQuery.brand = req.query.brand;
//         }
//         if (req.query.minPrice) {
//             filterQuery.salePrice = { $gte: parseInt(req.query.minPrice) };
//         }
//         if (req.query.maxPrice) {
//             filterQuery.salePrice = { ...filterQuery.salePrice, $lte: parseInt(req.query.maxPrice) };
//         }
//         if (req.query.search) {
//             filterQuery.productName = { $regex: req.query.search, $options: 'i' };
//         }

//         const products = await Product.find(filterQuery)
//             .sort(sortOption)
//             .skip(skip)
//             .limit(limit);

//         const totalProducts = await Product.countDocuments(filterQuery);
//         const totalPages = Math.ceil(totalProducts / limit);

//         const category = await Category.find();
//         const brand = await Brand.find();

//         const sortLabels = {
//             'featured': 'Featured',
//             'priceLowHigh': 'Price: Low to High',
//             'priceHighLow': 'Price: High to Low',
//             'aToZ': 'Name: Ascending',
//             'zToA': 'Name: Descending',
//             'balance': 'Stock Balance'
//         };

//         res.render('shop', {
//             products,
//             category,
//             brand,
//             currentPage: page,
//             totalPages,
//             currentSort: sortType,
//             sortLabels,
//             appliedFilters: req.query
//         });
//     } catch (error) {
//         console.error('Error in shop route:', error);
//         res.status(500).send('Internal Server Error');
//     }
// };


const loadShopPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;

        // Get the search term
        const searchTerm = req.query.search || '';

        // Get sort type from query
        const sortType = req.query.sort || 'featured';
        let sortOption = {};

        // Handle all sort cases from the EJS template
        switch (sortType) {
            case 'priceLowHigh':
                sortOption = { salePrice: 1 };
                break;
            case 'priceHigh':  // Changed from priceHighLow to match EJS
                sortOption = { salePrice: -1 };
                break;
            case 'nameAsc':    // Changed from aToZ to match EJS
                sortOption = { productName: 1 };
                break;
            case 'nameDesc':   // Changed from zToA to match EJS
                sortOption = { productName: -1 };
                break;
            case 'balance':
                sortOption = { quantity: -1 };
                break;
            case 'featured':
            default:
                // For featured, sort by createdAt to show newest first
                sortOption = { createdAt: -1 };
        }

        // Build filter query
        const filterQuery = {};

        // Search functionality
        if (searchTerm) {
            filterQuery.$or = [
                { productName: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        // Category and brand filters
        if (req.query.category) {
            filterQuery.category = req.query.category;
        }
        if (req.query.brand) {
            filterQuery.brand = req.query.brand;
        }

        // Price range filters
        if (req.query.minPrice) {
            filterQuery.salePrice = { $gte: parseInt(req.query.minPrice) };
        }
        if (req.query.maxPrice) {
            filterQuery.salePrice = {
                ...(filterQuery.salePrice || {}),
                $lte: parseInt(req.query.maxPrice)
            };
        }

        // Add isBlocked filter to only show unblocked products
        filterQuery.isBlocked = false;

        // Fetch products with pagination and sorting
        const products = await Product.find(filterQuery)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .populate('category')
            .populate('brand');

        const totalProducts = await Product.countDocuments(filterQuery);
        const totalPages = Math.ceil(totalProducts / limit);

        // Fetch categories and brands
        const category = await Category.find();
        const brand = await Brand.find();

        // Updated sort labels to match EJS options
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
        res.status(500).render('errorPage', { 
            message: 'An error occurred while loading the shop page.' 
        });
    }
};

module.exports = {
    productDetails,
    loadShopPage,
};


