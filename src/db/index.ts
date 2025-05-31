import mongoose from "mongoose";

/**
 * Connects to MongoDB using the connection string from environment variables.
 * Logs a success message or exits the process on failure.
 * @returns A promise that resolves when the connection is successful.
 */

export default async function connectDB() {
  try {
    // Try to connect to the MongoDB database
    const connectionInstance = await mongoose.connect(
      process.env.MONGODB_URI as string
    );
    console.log(
      `\nMongoDB connected successfully`,
      connectionInstance.connection.host
    );
  } catch (err) {
    // If connection fails, log the error and forcibly terminate the server
    console.log("MongoDB connection Failed: ", err);
    process.exit(1);
  }
}
