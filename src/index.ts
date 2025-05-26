import dotenv from "dotenv"
import connectDB from "./db/index.js"
import { app } from "./app.js"

dotenv.config({
    path: "./.env"
})

connectDB()
.then(()=>{
    app.on("error", (err)=>{
        console.log("ERROR: ", err)
        throw err;
    })
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server is running at port: ${process.env.PORT || 8000}`)
    })
})
.catch((err)=>{
    console.log("MongoDB connection Failed: ", err)
})