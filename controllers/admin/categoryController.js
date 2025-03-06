const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
const Brand=require('../../models/brandSchema')








const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        
        // Add search functionality
        const searchQuery = req.query.search ? {
            name: { $regex: new RegExp(req.query.search, 'i') }
        } : {};

        const categoryData = await Category.find(searchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("Category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalcategories: totalCategories,
            searchQuery: req.query.search || '' // Pass search query back to view
        });
    } catch (error) {
        console.error(error);
        res.redirect("/pageerror");
    }
};

const addCategory = async (req, res) => {
    const { name, description } = req.body;
    
    try {
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });
        
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists" });
        }

        const newCategory = new Category({
            name,
            description,
        });
        await newCategory.save();
        
        return res.json({ message: "Category added successfully", newCategory });
    } catch (error) {
        console.error('Error adding category:', error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

const getListCategory = async (req, res) => {
    try {
        let id = req.body.id; 
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

const getUnlistCategory = async (req, res) => {
    try {
        let id = req.body.id; 
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// const getListCategory = async (req, res) => {
//     try {
//         let id = req.query.id;
//         await Category.updateOne({ _id: id }, { $set: { isListed: false } });
//         res.redirect("/admin/category");
//     } catch (error) {
//         res.redirect("/pageerror");
//     }
// };

// const getUnlistCategory = async (req, res) => {
//     try {
//         let id = req.query.id;
//         await Category.updateOne({ _id: id }, { $set: { isListed: true } });
//         res.redirect("/admin/category");
//     } catch (error) {
//         res.redirect("/pageerror");
//     }
// };

const getEditCategory = async (req, res) => {
    try {
        const id = req.query.id;
        const category = await Category.findOne({ _id: id });
        res.render("edit-category", { category: category, currentPage: 'category' });
    } catch (error) {
        res.redirect("/pageerror");
    }
};

const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${categoryName}$`, 'i') },
            _id: { $ne: id }
        });

        if (existingCategory) {
            return res.status(400).json({ 
                error: "Category exists, please choose another name" 
            });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            {
                name: categoryName,
                description: description,
            },
            { new: true }
        );

        if (updatedCategory) {
            res.redirect("/admin/category");
        } else {
            res.status(404).json({ error: "Category not found" });
        }
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


// Modified addCategoryOffer function
const addCategoryOffer = async(req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
        
        // Validate percentage
        if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            return res.status(400).json({status: false, message: 'Invalid percentage value'});
        }
        
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({status: false, message: 'Category not found'});
        }
        
        // Find products in this category
        const products = await Product.find({category: category._id});
        
        // Check if any product has a higher offer
        const hasHigherProductOffer = products.some((product) => product.productOffer > percentage);
        if (hasHigherProductOffer) {
            return res.json({
                status: false, 
                message: 'Some products within this category already have higher product offers'
            });
        }
        
        // Update category with the offer
        await Category.updateOne({_id: categoryId}, {$set: {categoryOffer: percentage}});
        
        // Update all product prices in this category
        for (const product of products) {
            // Only apply category offer if it's better than product offer
            if (product.productOffer < percentage) {
                // Reset product offer since category offer is better
                product.productOffer = 0;
                
                // Calculate discounted price (apply category offer)
                const discountAmount = Math.floor(product.regularPrice * (percentage / 100));
                product.salePrice = product.regularPrice - discountAmount;
                
                await product.save();
            }
        }
        
        res.json({status: true, message: 'Category offer added successfully'});
    } catch (error) {
        console.error('Error adding category offer:', error);
        res.status(500).json({status: false, message: "Internal server error"});
    }
}

// Modified removeCategoryOffer function
const removeCategoryOffer = async(req, res) => {
    try {
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);
        
        if (!category) {
            return res.status(404).json({status: false, message: "Category not found"});
        }
        
        const percentage = category.categoryOffer;
        if (percentage === 0) {
            return res.json({status: true, message: "No offer to remove"});
        }
        
        const products = await Product.find({category: category._id});
        
        // Update product prices to remove category offer
        for (const product of products) {
            // Reset sale price to regular price (removing category offer effect)
            product.salePrice = product.regularPrice;
            
            // If the product had its own offer, reapply it
            if (product.productOffer > 0) {
                const discountAmount = Math.floor(product.regularPrice * (product.productOffer / 100));
                product.salePrice = product.regularPrice - discountAmount;
            }
            
            await product.save();
        }
        
        // Reset category offer
        category.categoryOffer = 0;
        await category.save();
        
        res.json({status: true, message: "Offer removed successfully"});
    } catch (error) {
        console.error('Error removing category offer:', error);
        res.status(500).json({status: false, message: "Internal server error"});
    }
}

module.exports={
    categoryInfo,
    addCategory,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
    addCategoryOffer,
    removeCategoryOffer,

}














