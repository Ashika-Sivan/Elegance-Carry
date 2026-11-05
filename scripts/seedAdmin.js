require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/userSchema');

const seedAdmin = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('Error: MONGODB_URI not found in environment variables.');
            process.exit(1);
        }

        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Database connected successfully.');

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@elegancecarry.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234';
        const adminName = process.env.ADMIN_NAME || 'Super Admin';

        let admin = await User.findOne({ email: adminEmail });

        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        if (admin) {
            console.log(`User with email "${adminEmail}" already exists. Updating to admin...`);
            admin.isAdmin = true;
            admin.password = hashedPassword;
            admin.isBlocked = false;
            await admin.save();
            console.log('Admin account updated successfully!');
        } else {
            console.log(`Creating new admin account for "${adminEmail}"...`);
            admin = new User({
                name: adminName,
                email: adminEmail,
                password: hashedPassword,
                isAdmin: true,
                isBlocked: false,
                wallet: 0
            });
            await admin.save();
            console.log('Admin account created successfully!');
        }

        console.log('-------------------------------------------');
        console.log('Admin Credentials:');
        console.log(`Email:    ${adminEmail}`);
        console.log(`Password: ${adminPassword}`);
        console.log('Login at: /admin/login');
        console.log('-------------------------------------------');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Failed to seed admin:', error);
        process.exit(1);
    }
};

seedAdmin();
