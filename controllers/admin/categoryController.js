const Category=require("../../models/categorySchema")
const Product=require("../../models/productSchema")
const Brand=require('../../models/brandSchema')
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require("../../enum/messages");
const { name } = require("ejs");




const categoryInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        
       
        const searchQuery = req.query.search ? {
            name: { $regex: new RegExp(req.query.search, 'i') }
        } : {};

        const categoryData = await Category.find(searchQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalcategories: totalCategories,
            searchQuery: req.query.search || '' 
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
            return res.status(HttpStatus.BAD_REQUEST).json({ error: "Category already exists" });
        }

    
        const newCategory = new Category({
            name,
            description,
        });
        await newCategory.save();
        
        return res.json({ message: "Category added successfully", newCategory });
    } catch (error) {
        console.error('Error adding category:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error:Messages.INTERNAL_SERVER_ERROR });
    }
};

const getListCategory = async (req, res) => {
    try {
        let id = req.body.id; 
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.status(HttpStatus.OK).json({ success: true });
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: Messages.INTERNAL_SERVER_ERROR });
    }
};

const getUnlistCategory = async (req, res) => {
    try {
        let id = req.body.id; 
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.status(HttpStatus.OK).json({ success: true });
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: Messages.INTERNAL_SERVER_ERROR });
    }
};


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
        const { categoryName, description } = req.body;
        const categoryId = req.params.id;

        if (!categoryName || !description) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Category name and description are required",
            });
        }

      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${categoryName}$`, 'i') }, 
        _id: { $ne: categoryId },
    });

    

        if (existingCategory) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Category with this name already exists",
            });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { name: categoryName, description },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message: "Category not found",
            });
        }

        return res.status(HttpStatus.OK).json({
            success: true,
            message: "Category updated successfully",
        });
    } catch (error) {
        console.error("Error in editCategory:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "An error occurred while updating the category",
        });
    }
};

const addCategoryOffer = async(req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
       
        if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            return res.status(HttpStatus.BAD_REQUEST).json({status: false, message: 'Invalid percentage value'});
        }
        
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(HttpStatus.NOT_FOUND).json({status: false, message:Messages.CATEGORY_NOT_FOUND});
        }
        
      
        const products = await Product.find({category: category._id});//here we are finding out the categories by uisng the categoryId(selected categ)
        
        const hasHigherProductOffer = products.some((product) => product.productOffer > percentage);
        if (hasHigherProductOffer) {
            return res.json({
                status: false, 
                message: 'Some products within this category already have higher product offers'
            });
        }
        
        await Category.updateOne({_id: categoryId}, {$set: {categoryOffer: percentage}});
        
      
        for (const product of products) {
            if (product.productOffer < percentage) {
                product.productOffer = 0;
                const discountAmount = Math.floor(product.regularPrice * (percentage / 100));
                product.salePrice = product.regularPrice - discountAmount;
                
                await product.save();
            }
        }
        
        res.json({status: true, message:`category ${Messages.OFFER_ADD}`});
    } catch (error) {
        console.error('Error adding category offer:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: false, message: Messages.INTERNAL_SERVER_ERROR});
    }
}

const removeCategoryOffer = async(req, res) => {
    try {
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);
        
        if (!category) {
            return res.status(HttpStatus.NOT_FOUND).json({status: false, message: Messages.CATEGORY_NOT_FOUND});
        }
        
        const percentage = category.categoryOffer;
        if (percentage === 0) {
            return res.json({status: true, message: "No offer to remove"});
        }
        
        const products = await Product.find({category: category._id});
        
        for (const product of products) {
            product.salePrice = product.regularPrice;
            if (product.productOffer > 0) {
                const discountAmount = Math.floor(product.regularPrice * (product.productOffer / 100));
                product.salePrice = product.regularPrice - discountAmount;
            }
            
            await product.save();
        }
        
      
        category.categoryOffer = 0;
        await category.save();
        
        res.json({status: true, message: Messages.OFFER_REMOVE});
    } catch (error) {
        console.error('Error removing category offer:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: false, message: Messages.INTERNAL_SERVER_ERROR});
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














