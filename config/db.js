

const mongoose = require("mongoose");
const dotenv = require("dotenv").config();

let isConnected = false;

const connectDB = async () => {
    if (isConnected || mongoose.connection.readyState === 1) {
        return;
    }

    try {
        if (!process.env.MONGODB_URI) {
            console.error("MONGODB_URI is not defined in environment variables");
            return;
        }
        await mongoose.connect(process.env.MONGODB_URI);
        isConnected = true;
        console.log("DB connected");
    } catch (error) {
        console.error("DB Connection error", error.message);
    }
};

module.exports = connectDB;