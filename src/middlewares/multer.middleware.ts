import multer from "multer";
import path from "path"

const storage = multer.diskStorage({
    destination: function (req, file, cb){
        cb(null, "./public/temp")
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random()* 1E9)
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname).toLocaleLowerCase())
    }
})

export const upload = multer({storage, limits: { fileSize: 3 * 1024 * 1024 }}) // 3MB limit