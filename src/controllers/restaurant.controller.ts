import { Restaurant } from "../models/restaurant.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

//   restaurantName: string; // Full name of the restaurant
//   slug: string; // Slug for the restaurant (unique, 3-8 chars)
//   logoUrl?: string; // Optional URL to the restaurant's logo
//   description?: string; // Optional description of the restaurant
//   isCurrentlyOpen: boolean; // Whether the restaurant is currently open
//   ownerId: Types.ObjectId; // Reference to the User who owns the restaurant
//   categories?: string[]; // Optional array of categories/cuisines
//   openingTime?: string; // Optional opening time (e.g., "09:00")
//   closingTime?: string; // Optional closing time (e.g., "22:00")
//   taxRate: number; // Number of percentage owner wants to charge for taxes based on the sub total of order value like 5
//   taxLabel?: string; // "GST", "VAT"
//   isTaxIncludedInPrice: boolean; // Is taxes are already included with all food item's price
//   address?: string; // Optional address of restaurant

export const createRestaurant = asyncHandler(async (req, res) => {
  const { restaurantName, slug, description, address } = req.body;
  const ownerId = req.user!._id;
  //   const logoLocalPath = req.file?.path;

  if (!restaurantName || !slug) {
    throw new ApiError(400, "Restaurant name and slug both are required.");
  }
  
  const restaurant = await Restaurant.create({
    restaurantName,
    slug,
    description,
    address,
    ownerId,
  });
    if (!restaurant) {
        throw new ApiError(500, "Failed to create restaurant.");
    }
    // If logo is uploaded, set the logoUrl
    // if (logoLocalPath) {
    //   const logoUrl = `${process.env.BASE_URL}/uploads/${req.file?.filename}`;
    //   restaurant.logoUrl = logoUrl;

    //   await restaurant.save({validateBeforeSave: false});
    // }
  // Add the restaurant to the user's ownedRestaurants array

    req.user!.restaurantIds!.push(restaurant._id as any); // Type assertion to avoid TS error
    // Ensure the restaurantIds array is unique
    req.user!.restaurantIds = Array.from(new Set(req.user!.restaurantIds));
    // Save the user without validation to avoid triggering validation errors
  req.user!.save({validateBeforeSave: false});
  res
    .status(201)
    .json(new ApiResponse(201, restaurant, "Restaurant created successfully"));
});
