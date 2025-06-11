import { FoodItem } from "../models/foodItem.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Restaurant } from "../models/restaurant.models.js";
import { canCreateFoodItem } from "../service/foodItem.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const createFoodItem = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "owner") {
    throw new ApiError(403, "You are not authorized to create food items");
  }

  if (!req.params || !req.params.restaurantSlug) {
    throw new ApiError(400, "Restaurant slug is required");
  }

  if (
    !req.body ||
    !req.body.foodName ||
    !req.body.price ||
    !req.body.foodType
  ) {
    throw new ApiError(400, "Food name, price, and food type are required");
  }
  const {
    foodName,
    price,
    discountedPrice,
    hasVariants = false,
    variants = [],
    imageUrls = [],
    category,
    foodType,
    description,
    tags = [],
  } = req.body;

  if (foodType && !["veg", "non-veg"].includes(foodType)) {
    throw new ApiError(400, "Food type must be either 'veg' or 'non-veg'");
  }

  if (!hasVariants && variants.length > 0) {
    throw new ApiError(
      400,
      "Variants should not be provided when hasVariants is false"
    );
  }

  if (hasVariants && variants.length === 0) {
    throw new ApiError(400, "Variants are required when hasVariants is true");
  }

  if (hasVariants && variants.length > 6) {
    throw new ApiError(400, "You can only create a maximum of 6 food variants");
  }

  const restaurant = await Restaurant.findOne({
    slug: req.params.restaurantSlug,
    ownerId: req.user._id,
  });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found or you are not the owner");
  }

  if (
    category &&
    restaurant.categories.length > 0 &&
    !restaurant.categories.includes(category)
  ) {
    throw new ApiError(
      400,
      "Category must be one of the restaurant's categories"
    );
  }

  await canCreateFoodItem(req.subscription!, restaurant._id!.toString());
  // Check if the food item already exists
  const existingFoodItem = await FoodItem.findOne({
    restaurantId: restaurant._id,
    foodName,
  });

  if (existingFoodItem) {
    throw new ApiError(
      400,
      "Food item with this name already exists in the restaurant"
    );
  }

  // Create the food item
  const foodItem = await FoodItem.create({
    restaurantId: restaurant._id,
    foodName,
    price,
    discountedPrice,
    hasVariants,
    variants,
    imageUrls,
    category,
    foodType,
    description,
    tags,
  });

  if (!foodItem) {
    throw new ApiError(500, "Failed to create food item");
  }
  res
    .status(201)
    .json(new ApiResponse(201, foodItem, "Food item created successfully"));
});
