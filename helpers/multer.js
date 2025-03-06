// const multer=require("multer");
// const path=require("path")


// const storage=multer.diskStorage({
//     destination:(req,file,cb)=>{
//         cb(null,path.join(__dirname,"../public/img"))
//     },
//     filename:(req,file,cb)=>{
//         cb(null,Date.now()+"-"+file.originalname)
//     }
// })
// module.exports=storage

const multer = require("multer");
const path = require("path");

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../public/img"));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

// File filter function
const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPEG, JPG, and PNG files are allowed."), false);
    }
};

// Create multer upload instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB file size limit
    }
});

// Error handling middleware
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: err.message });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};

module.exports = {
    upload,
    handleMulterError
};

// const multer = require("multer");
// const path = require("path");

// // Configure storage
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, path.join(__dirname, "../public/img"));
//     },
//     filename: (req, file, cb) => {
//         cb(null, Date.now() + "-" + file.originalname);
//     }
// });

// // File filter function
// const fileFilter = (req, file, cb) => {
//     // Allowed file types
//     const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    
//     if (allowedTypes.includes(file.mimetype)) {
//         cb(null, true); // Accept file
//     } else {
//         cb(new Error("Invalid file type. Only JPEG, JPG, and PNG files are allowed."), false);
//     }
// };

// // Create multer upload instance with validation
// const uploads = multer({
//     storage: storage,
//     fileFilter: fileFilter,
//     limits: {
//         fileSize: 5 * 1024 * 1024, // 5MB file size limit
//     }
// });

// // Error handling middleware for multer
// const handleMulterError = (err, req, res, next) => {
//     if (err instanceof multer.MulterError) {
//         // Multer-specific errors
//         if (err.code === 'LIMIT_FILE_SIZE') {
//             return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
//         }
//         return res.status(400).json({ error: err.message });
//     } else if (err) {
//         // Custom errors from fileFilter
//         return res.status(400).json({ error: err.message });
//     }
//     next();
// };

// module.exports = {
//     uploads,
//     handleMulterError
// };