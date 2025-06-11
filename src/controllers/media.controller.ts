import { Restaurant } from "../models/restaurant.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";
import { TemporaryMedia } from "../models/temporaryMedia.model.js";

export const restaurantLogoUpload = asyncHandler(async (req, res) => {
  const logoLocalPath = req.file?.path;
  if (!logoLocalPath) {
    throw new ApiError(400, "Logo file is required");
  }

  if (req.user!.role !== "owner") {
    fs.unlinkSync(logoLocalPath); // Remove the file if the user is not an owner
    throw new ApiError(403, "Only owners can upload restaurant logos");
  }

  const uploadResponse = await cloudinary.upload(
    logoLocalPath,
    `restaurant-logos/restaurants-${req.user!._id}` // Use the owner's ID to create a unique folder
  );
  if (!uploadResponse) {
    fs.unlinkSync(logoLocalPath); // Remove the file if upload fails
    throw new ApiError(500, "Failed to upload logo to Cloudinary");
  }

  await TemporaryMedia.create({
    userId: req.user!._id,
    mediaUrl: uploadResponse.secure_url,
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        uploadResponse.secure_url,
        "Logo uploaded successfully"
      )
    );
});

export const restaurantLogoDelete = asyncHandler(async (req, res) => {
  if (!req.body || !req.body.mediaUrl) {
    throw new ApiError(400, "Media URL is required");
  }
  if (!req.user!.restaurantIds || req.user!.restaurantIds.length === 0) {
    throw new ApiError(403, "User does not own any restaurants");
  }
  const { mediaUrl } = req.body;

  if (req.user!.role !== "owner") {
    throw new ApiError(403, "Only owners can delete restaurant logos");
  }

  let restaurant: Restaurant | null = null;

  // Check if the mediaUrl exists in TemporaryMedia
  const tempMedia = await TemporaryMedia.findOne({
    userId: req.user!._id,
    mediaUrl: mediaUrl,
  });
  if (!tempMedia) {
    // If not found in TemporaryMedia, check in Restaurant
    restaurant = await Restaurant.findOne({
      logoUrl: mediaUrl,
      ownerId: req.user!._id,
    });
    if (!restaurant) {
      throw new ApiError(
        404,
        "Logo not found in user's restaurants or temporary media"
      );
    }
  }

  const response = await cloudinary.delete(mediaUrl);

  if (!response || response.result !== "ok") {
    throw new ApiError(500, "Failed to delete logo from Cloudinary");
  }
  // If the logo was in TemporaryMedia, delete it from there
  if (tempMedia) {
    // Remove the logo from TemporaryMedia
    await tempMedia.deleteOne();
  } else if (restaurant) {
    // If the logo was in Restaurant, update the restaurant's logoUrl
    restaurant.logoUrl = undefined;
    await restaurant.save({ validateBeforeSave: false }); // Save the restaurant without validation
  }
  res.status(200).json(new ApiResponse(200, null, "Logo deleted successfully"));
});

export const foodItemImageUpload = asyncHandler(async (req, res) => {
  const imageLocalPaths = Array.isArray(req.files) ? req.files : [];
  if (!imageLocalPaths || imageLocalPaths.length === 0) {
    throw new ApiError(400, "At least one image file is required");
  }
  if (imageLocalPaths.length > 5) {
    imageLocalPaths.forEach((file: Express.Multer.File) => {
      fs.unlinkSync(file.path); // Remove the files if more than 5 images are uploaded
    });
    throw new ApiError(400, "You can only upload a maximum of 5 images");
  }
  // Check if the user is an owner
  if (req.user!.role !== "owner") {
    imageLocalPaths.forEach((file: Express.Multer.File) => {
      fs.unlinkSync(file.path); // Remove the file if the user is not an owner
    });
    throw new ApiError(403, "Only owners can upload menu item images");
  }
  const uploadPromises = imageLocalPaths.map((file: Express.Multer.File) => {
    return cloudinary.upload(
      file.path,
      `menu-item-images/restaurants-${req.user!._id}`
    );
  });

  const uploadResponses = await Promise.all(uploadPromises);
  const imageUrls = uploadResponses
    .filter((response) => response && response.secure_url)
    .map((response) => response!.secure_url);

  if (imageUrls.length === 0) {
    imageLocalPaths.forEach((file: Express.Multer.File) => {
      fs.unlinkSync(file.path); // Remove files if upload fails
    });
    throw new ApiError(500, "Failed to upload images to Cloudinary.");
  }

  // Save the image URLs to TemporaryMedia one by one
  const tempMediaPromises = imageUrls.map((url) => {
    return TemporaryMedia.create({
      userId: req.user!._id,
      mediaUrl: url,
    });
  });
  
  await Promise.all(tempMediaPromises);

  res
    .status(200)
    .json(new ApiResponse(200, imageUrls, "Images uploaded successfully"));
});

export const deleteFoodItemImage = asyncHandler(async (req, res) => {
  if (!req.body || !req.body.mediaUrl) {
    throw new ApiError(400, "Media URL is required");
  }
  const { mediaUrl } = req.body;

  if (req.user!.role !== "owner") {
    throw new ApiError(403, "Only owners can delete menu item images");
  }

  // Check if the mediaUrl exists in TemporaryMedia
  const tempMedia = await TemporaryMedia.findOne({
    userId: req.user!._id,
    mediaUrl: mediaUrl,
  });
  if (!tempMedia) {
    throw new ApiError(404, "Image not found");
  }

  const response = await cloudinary.delete(mediaUrl);

  if (!response || response.result !== "ok") {
    throw new ApiError(500, "Failed to delete image from Cloudinary");
  }

  // Remove the image from TemporaryMedia
  await tempMedia.deleteOne();

  res.status(200).json(new ApiResponse(200, null, "Image deleted successfully"));
});