import multer from "multer";
import path from "path"
import { ApiError } from "../utils/ApiError.js";

const storage = multer.diskStorage({
    destination: function (req, file, cb){
        cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random()* 1E9)
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname).toLocaleLowerCase())
    }
});

const fileFilter = function (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLocaleLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
        return cb(null, true);
    }
    cb(new ApiError(400, "Only JPEG, JPG, and PNG files are allowed."));
};
export const upload = multer({storage, fileFilter, limits: { fileSize: 3 * 1024 * 1024 }}) // 3MB limit