const express = require('express');
const session = require("express-session");
const passport=require("./config/passport")
const mongoStore = require('connect-mongo');
const path = require('path');
const dotenv = require('dotenv');
const userRouter = require('./routes/userRouter');
const adminRouter=require("./routes/adminRouter")
const connectDB = require('./config/db');
const errorHandler=require('./middlewares/errorHandler')

require ('dotenv').config();
const app = express();
const PORT = process.env.PORT || 4000;
connectDB();

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);

// third party middleware 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'ELEGANCE_SECRET',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000
    },
    store: mongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 72 * 60 * 60,
        autoRemove: 'native'
    })
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use(passport.initialize());  
app.use(passport.session())

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.set('cache-control', 'no-store');
    next();
});

app.use('/', userRouter); // Handles requests from users
app.use('/admin', adminRouter); // handl requests from admins
app.use(errorHandler); //   error handling middleware





app.listen(process.env.PORT, () => {
    console.log(`server is running http://localhost:${PORT}`);
    console.log(`admin server is running in http://localhost:${PORT}/admin/login`);
    
});
