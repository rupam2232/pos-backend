import { Restaurant } from "../models/restaurant.models.js";
import { canCreateRestaurant } from "../service/restaurant.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { RESTAURANT_CREATED_TEMPLATE } from "../utils/emailTemplates.js";
import sendEmail from "../utils/sendEmail.js";

export const createRestaurant = asyncHandler(async (req, res) => {
  if (!req.body?.restaurantName || !req.body?.slug) {
    throw new ApiError(400, "Restaurant name and slug are required.");
  }
  const { restaurantName, slug, description, address, logoUrl } = req.body;
  const ownerId = req.user!._id;
  //   const logoLocalPath = req.file?.path;
  if (req.user!.role !== "owner") {
    throw new ApiError(403, "Only owners can create restaurants.");
  }

  await canCreateRestaurant(req.user!);

  const restaurant = await Restaurant.create({
    restaurantName,
    slug,
    description,
    address,
    ownerId,
    logoUrl
  });
  if (!restaurant) {
    throw new ApiError(500, "Failed to create restaurant.");
  }
  
  req.user!.restaurantIds!.push(restaurant._id as any); // Type assertion to avoid TS error
  // Ensure the restaurantIds array is unique
  req.user!.restaurantIds = Array.from(new Set(req.user!.restaurantIds));
  // Save the user without validation to avoid triggering validation errors
  await req.user!.save({ validateBeforeSave: false });

  sendEmail(
    req.user!.email,
    "restaurant-created",
    RESTAURANT_CREATED_TEMPLATE.replaceAll(
      "{restaurantName}",
      restaurant.restaurantName
    )
      .replace("{name}", req.user!.firstName ?? "User")
      .replace("{slug}", restaurant.slug)
      .replace("{description}", restaurant.description ?? "Not defined")
      .replace("{address}", restaurant.address ?? "Not defined")
  );
  res
    .status(201)
    .json(new ApiResponse(201, restaurant, "Restaurant created successfully"));
});
