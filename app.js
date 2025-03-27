const express = require('express');//framework build the server
const session = require("express-session");//manage user session(keep someone logged in)
const passport=require("./config/passport")//for authentication(login/logout)
const mongoStore = require('connect-mongo');//stopre session data in mongodb
const path = require('path');//file path that is views or static file
const dotenv = require('dotenv');//load env variable
const userRouter = require('./routes/userRouter');
const adminRouter=require("./routes/adminRouter")
const connectDB = require('./config/db');//custom function to connect db
const errorHandler=require('./middlewares/errorHandler')//to catch error

require ('dotenv').config();
const app = express();
const PORT = process.env.PORT || 4000;
connectDB();//link app to db

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);

// third party middleware 
app.use(express.json());//parse incoming json data
app.use(express.urlencoded({ extended: true }));//parse form data
app.use(session({
    secret: process.env.SESSION_SECRET || 'ELEGANCE_SECRET',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,//prevent client side script from assessing cokkie
        maxAge: 72 * 60 * 60 * 1000//session lst 72 hr in mil sec
    },
    store: mongoStore.create({//save session in mongodb with 72 hr time lmt
        mongoUrl: process.env.MONGODB_URI,
        ttl: 72 * 60 * 60,
        autoRemove: 'native'
    })
}));


//make session available to views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;//locals:make available in all ejs template
    next();
});

app.use(passport.initialize());  //sett passport for authentication
app.use(passport.session())        //integrate passport with session

app.use(express.static(path.join(__dirname, 'public')));//serve public file directly to browser

app.use((req, res, next) => {//tell browser not to cache page ensure fresh contents
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
