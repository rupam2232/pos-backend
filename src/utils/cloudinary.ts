import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import fs from "fs";
import { ApiError } from "./ApiError.js";

class cloudinaryOptions {
    cloudinary = cloudinary
    constructor() {}

    async upload (localPath: string, folder: string): Promise<UploadApiResponse | null> {
        try{
            if (!localPath || !fs.existsSync(localPath) || !folder) {
                throw new ApiError(400, "Invalid file path or folder name.");
            }
            const response = await this.cloudinary.uploader.upload(localPath, {
                resource_type: "auto",
                asset_folder: `${process.env.MAIN_MEDIA_FOLDER_NAME}/${folder}`,
            });
            // Remove the local file after uploading
            fs.unlinkSync(localPath);
            return response;
        } catch (error) {
            fs.unlinkSync(localPath); // Ensure the local file is removed even if upload fails
            throw new ApiError(500, "Failed to upload file to Cloudinary.");
        }
    }

    async delete(mediaUrl: string, resourceType: string = "image"): Promise<any>{
        try {
            const lastSegment = mediaUrl?.split("/")?.pop();
            const publicId = lastSegment ? lastSegment.split(".")[0] : "";
            if (!publicId) {
                throw new ApiError(400, "Invalid media URL.");
            }
            const response = await this.cloudinary.uploader.destroy(publicId,{
                resource_type: resourceType,
                invalidate: true
            })
            return response;
        } catch (error) {
            console.error("Error deleting file from Cloudinary:", error);
            throw new ApiError(500, "Failed to delete file from Cloudinary.");
        }
    }
}

const cloudinaryUtils = new cloudinaryOptions();
export default cloudinaryUtils;