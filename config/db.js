

const mongoose = require("mongoose");
const dotenv = require("dotenv").config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);//connect mongodb with our app in .env
        console.log("DB connected");
    } catch (error) {
        console.log("DB Connection error", error.message);
        process.exit(1);//it is to stop the app when db fails
    }
};

module.exports = connectDB;