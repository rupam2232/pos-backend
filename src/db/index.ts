import mongoose from "mongoose";

export default async function connectDB(){
    try {
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI as string)
        console.log(`\n MongoDB connected successfully`, connectionInstance.connection.host)
    } catch (err) {
        console.log("MongoDB connection Failed: ", err)
        process.exit(1)
    }
};