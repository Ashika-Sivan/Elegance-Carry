    const mongoose= require("mongoose");
    const{Schema}=mongoose;

    const productSchema=new Schema({
        productName:{
            type:String,
            required:true
        },
        description:{
            type:String,
            required:true
        },

        brand: {
            type: Schema.Types.ObjectId,
            ref: 'Brand',  
            required: true
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: 'Category', 
            required: true
        },

        regularPrice:{
            type:Number,
            required:true
        },
        salePrice:{
            type:Number,
            // required:true
        },
        productOffer:{
            type:Number,
            default:0
        },
        quantity:{
            type:Number,
            default:true
        },
        color:{
            type:String,
            // required:true
        },
        productImage:{
            type:[String],
            required:true,

        },
        subcategory:{
            type:String,
            // required:true
        },
        isBlocked:{
            type:Boolean,
            default:false
        },                                                                                                                                                                                                                                                                                                                                          
        isFeatured: {
            type: Boolean,
            default: false
        },

    },{timestamps:true});
    productSchema.index({ salePrice: 1 });
    productSchema.index({ productName: 1 });
    productSchema.index({ quantity: -1 });

    const Product= mongoose.model("Product",productSchema)
    module.exports=Product;