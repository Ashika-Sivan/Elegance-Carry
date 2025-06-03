const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path");
const sharp = require("sharp");//to resize images
const { log } = require("console");
const mongoose=require('mongoose')
const HttpStatus = require('../../enum/httpStatus');
const OrderStatus = require('../../enum/orderStatus');
const Messages = require("../../enum/messages");



const getProductAddPage = async (req, res) => {
    try {

        const category = await Category.find({ isListed: true })
        const brand = await Brand.find({ isBlocked: false })
        res.render("product-add", {
            cat: category,
            brand: brand,
            currentPage: "addProducts",
        })

    } catch (error) {

        console.log('getProductAddPage error',error);
        
        res.redirect("/pageerror")

    }

}

const addProducts = async (req, res) => {
    try {
        const products = req.body;

      
        const productExists = await Product.findOne({ productName: products.productName });
        if (productExists) {
            return res.status(400).send("Product already exists, please try another name");
        }

        if (!mongoose.Types.ObjectId.isValid(products.brand)) {
            return res.status(400).send("Invalid brand ID");
        }

        const images = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const resizedFilename = `resized-${Date.now()}-${file.filename}`;
                    const resizedImagePath = path.join('public', 'img', resizedFilename);

                   
                    await sharp(file.path)
                        .resize(440, 440, {
                            fit: 'contain',
                            background: { r: 255, g: 255, b: 255, alpha: 1 }
                        })
                        .jpeg({ quality: 90 })
                        .toFile(resizedImagePath);

                    images.push(resizedFilename);

                    await fs.unlink(file.path).catch(err => {
                        console.warn(`Warning: Could not delete original file ${file.path}:`, err);
                    });
                } catch (error) {
                    console.error(`Error processing image ${file.filename}:`, error);
                   
                }
            }
        }

        // Validate category
        const categoryId = await Category.findOne({ name: products.category });
        if (!categoryId) {
            return res.status(400).send("Invalid category name");
        }

        // Create new product
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: categoryId._id,
            regularPrice: products.regularPrice,
            salePrice: products.salePrice || 0,
            createdOn: new Date(),
            quantity: products.quantity,
            color: products.color,
            productImage: images,
            status: 'Available',
        });

        await newProduct.save();
        return res.redirect("/admin/products");
    } catch (error) {
        console.error("Error saving product:", error);
        return res.redirect("/admin/pageerror");
    }
};


const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 5;

        console.log("Search term:", search); 
        const matchingBrands = await Brand.find({
            name: { $regex: new RegExp(search, "i") },
            isBlocked: false,
        }).select("_id");


        const query = search
    ? {
          $or: [
              { productName: { $regex: new RegExp(search, "i") } },
              { brand: { $in: matchingBrands.map((brand) => brand._id) } },
          ],
      }
    : {};

        const productData = await Product.find(query)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate("category")
            .populate("brand")
            .exec();

        const count = await Product.countDocuments(query);

        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        if (category && brand) {
            res.render("products", {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                brand: brand,
                search: search, 
            });
        } else {
            res.render("page-404");
        }
    } catch (error) {
        console.error("Error loading products page:", error);
        res.redirect("/pageerror");
    }
};

const blockProduct = async (req, res) => {
    try {
        let id = req.body.id; // Changed from req.query to req.body

        await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.status(HttpStatus.OK).json({ success: true });
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: Messages.INTERNAL_SERVER_ERROR });
    }
};

const unblockProduct = async (req, res) => {
    try {
        let id = req.body.id; // Changed from req.query to req.body
        await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.status(HttpStatus.OK).json({ success: true });
    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: Messages.INTERNAL_SERVER_ERROR });
    }
};

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        console.log("Product ID:", id); // Log the ID

        if (!id) {
            console.error("Product ID is missing");
            return res.redirect("/pageerror");
        }

        const product = await Product.findOne({ _id: id });
        if (!product) {
            console.error("Product not found");
            return res.redirect("/pageerror");
        }

        const category = await Category.find({});
        const brand = await Brand.find({});

        res.render("edit-product", {
            product: product,
            cat: category,
            brand: brand,
            currentPage: "editProduct", // Use a string instead of a variable `page`
        });
    } catch (error) {
        console.error("Error in getEditProduct:", error);
        res.redirect("/pageerror");
    }
};

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        console.log('Product ID:', id); 

        // current product
        const product = await Product.findById(id);
        if (!product) {
            throw new Error(Messages.PRODUCT_NOT_FOUND);
        }

        const data = req.body;
        console.log('Received data:', data); 


        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id } 
        });

        if (existingProduct) {
            return res.status(HttpStatus.BAD_REQUEST).json({ 
                error: "Product with name already exists. Please try with another name" 
            });
        }

        // Handle images
        const images = [];
        if (req.files && req.files.length > 0) {
            images.push(...req.files.map(file => file.filename));
        }

        // Prepare update fields
        const updateFields = {
            productName: data.productName,
            description: data.description,
            brand: data.brand || product.brand,
            category: product.category, 
            regularPrice: data.regularPrice,
            salePrice: data.salePrice || null,
            quantity: data.quantity,
            color: data.color
        };

        // Only add images if there are new ones
        if (images.length > 0) {
            updateFields.$push = { productImage: { $each: images } };
        }

        // Update the product
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            updateFields,
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            throw new Error('Failed to update product');
        }

        console.log('Updated product:', updatedProduct); // Debug log
        res.redirect("/admin/products");

    } catch (error) {
        console.error('Edit product error:', error);
        res.redirect("/pageerror");
    }
};



const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body;
        
     
        if (!imageNameToServer || !productIdToServer) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: "Missing required parameters"
            });
        }

       
        if (!mongoose.Types.ObjectId.isValid(productIdToServer)) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: `${Messages.INVALID_PRODUCT_ID} format`
            });
        }

  
        const result = await Product.updateOne(
            { _id: productIdToServer },
            { $pull: { productImage: imageNameToServer } }
        );

        if (result.modifiedCount === 0) {
            return res.status(HttpStatus.NOT_FOUND).json({
                status: false,
                message: "Product not found or image already removed"
            });
        }

       
        const imagePath = path.join(process.cwd(), "public", "img", imageNameToServer);
        try {
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        } catch (fsError) {
            console.error("File system error:", fsError);
     
        }

        return res.json({
            status: true,
            message: "Image deleted successfully"
        });

    } catch (error) {
        console.error("Delete image error:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: Messages.INTERNAL_SERVER_ERROR,
            error: error.message
        });
    }
};

const addProductOffer = async(req, res) => {
    try {
        const {productId, percentage} = req.body;
        
        if (!productId || !percentage) {
            return res.json({status: false, message: "ProductId and percentage are required"});
        }
        
        const findProduct = await Product.findOne({_id: productId});
        if (!findProduct) {
            return res.json({status: false, message: Messages.PRODUCT_NOT_FOUND});
        }
        
        const findCategory = await Category.findOne({_id: findProduct.category});
        if(findCategory.categoryOffer > percentage){
            return res.json({status: false, message: "This product's category already has a higher category offer"});
        }
        
   
        if (!findProduct.regularPrice) {
            findProduct.regularPrice = findProduct.salePrice;
        }
        
       
        findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice * (percentage / 100));
        findProduct.productOffer = parseInt(percentage);
        
        await findProduct.save();
        
        findCategory.categoryOffer = 0;
        await findCategory.save();
        
        return res.json({status: true});
    } catch (error) {
        console.error("Error in addProductOffer:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: false, message: Messages.INTERNAL_SERVER_ERROR});
    }
}

const removeProductOffer = async(req, res) => {
    try {
        const {productId} = req.body;
        
        if (!productId) {
            return res.json({status: false, message: "ProductId is required"});
        }
        
        const findProduct = await Product.findOne({_id: productId});
        if (!findProduct) {
            return res.json({status: false, message: Messages.PRODUCT_NOT_FOUND});
        }
        
        
        findProduct.salePrice = findProduct.regularPrice;
        findProduct.productOffer = 0;
        
        await findProduct.save();
        return res.json({status: true});
    } catch (error) {
        console.error("Error in removeProductOffer:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({status: false, message: Messages.INTERNAL_SERVER_ERROR});
    }
}

module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    addProductOffer,
    removeProductOffer,

}