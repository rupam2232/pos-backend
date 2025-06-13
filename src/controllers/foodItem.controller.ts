import { FoodItem } from "../models/foodItem.model.js";
import type { FoodVariant as FoodVariantType } from "../models/foodItem.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Restaurant } from "../models/restaurant.models.js";
import { canCreateFoodItem } from "../service/foodItem.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import cloudinary from "../utils/cloudinary.js";
import { isValidObjectId } from "mongoose";

function hasDuplicates(arr: string[]): boolean {
  const lowerArr = arr.map((tag) => tag.trim().toLowerCase());
  // check if all the fields are available
  if (!Array.isArray(lowerArr) || lowerArr.length === 0) {
    return false; // No duplicates in an empty array
  }
  // Check for empty strings
  if (lowerArr.some((tag) => tag === "" || tag === null || tag === undefined)) {
    throw new ApiError(400, "Tags and names cannot be empty strings or null");
  }
  return new Set(lowerArr).size !== lowerArr.length;
}

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

  if (imageUrls.length > 5) {
    throw new ApiError(
      400,
      "You can only upload a maximum of 5 images for a food item"
    );
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

  // Usage for tags
  if (tags && tags.length > 0 && hasDuplicates(tags)) {
    throw new ApiError(400, "all Tags must be unique.");
  }

  // Usage for variants (assuming each variant has a variantName property)
  if (variants && variants.length > 0) {
    const variantNames = variants.map(
      (v: FoodVariantType) => v.variantName?.trim().toLowerCase() || ""
    );
    if (hasDuplicates(variantNames)) {
      throw new ApiError(400, "All variant names must be unique.");
    }
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

export const getAllFoodItemsOfRestaurant = asyncHandler(async (req, res) => {
  if (!req.params || !req.params.restaurantSlug) {
    throw new ApiError(400, "Restaurant slug is required");
  }

  const {
    page = 1,
    limit = 10,
    sortBy = "foodName", // Default sort by foodName
    sortType = "asc",
  } = req.query;

  const pageNumber = parseInt(page.toString());
  const limitNumber = parseInt(limit.toString());

  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Page and limit must be positive integers");
  }

  const restaurant = await Restaurant.findOne({
    slug: req.params.restaurantSlug,
  });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const foodItems = await FoodItem.find({
    restaurantId: restaurant._id,
  })
    .sort({
      isAvailable: -1, // Sort by availability first (available items first)
      // Then sort by the specified field
      [sortBy.toString()]: sortType === "asc" ? 1 : -1, // Ascending or descending sort
    })
    .skip((pageNumber - 1) * limitNumber) // Pagination logic
    .limit(limitNumber) // Limit the number of results
    .select("-restaurantId -__v"); // Exclude restaurantId and __v fields;

  if (!foodItems || foodItems.length === 0) {
    res.status(404).json(
      new ApiResponse(
        404,
        {
          foodItems: [],
          page: pageNumber,
          limit: limitNumber,
          totalPages: 0,
          totalCount: 0,
        },
        "No food items found for this restaurant"
      )
    );
  } else {
    const foodItemCount = await FoodItem.countDocuments({
      restaurantId: restaurant._id,
    });
    const totalPages = Math.ceil(foodItemCount / limitNumber);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          foodItems,
          page: pageNumber,
          limit: limitNumber,
          totalPages,
          totalCount: foodItemCount,
        },
        "Food items fetched successfully"
      )
    );
  }
});

export const getFoodItemById = asyncHandler(async (req, res) => {
  if (!req.params || !req.params.foodItemId || !req.params.restaurantSlug) {
    throw new ApiError(400, "Food item ID and restaurant slug are required");
  }

  if (!isValidObjectId(req.params.foodItemId)) {
    throw new ApiError(400, "Invalid food item ID");
  }

  const foodItem = await FoodItem.findById(req.params.foodItemId)
    .select("-__v")
    .populate({ path: "restaurantId", select: "name slug categories" });

  if (!foodItem) {
    throw new ApiError(404, "Food item not found");
  }

  // Check if restaurantId is populated and has a slug property
  if (
    !foodItem.restaurantId ||
    typeof foodItem.restaurantId !== "object" ||
    !("slug" in foodItem.restaurantId) ||
    (foodItem.restaurantId as any).slug !== req.params.restaurantSlug
  ) {
    throw new ApiError(404, "Food item not found in this restaurant");
  }

  res
    .status(200)
    .json(new ApiResponse(200, foodItem, "Food item fetched successfully"));
});

export const toggleFoodItemAvailability = asyncHandler(async (req, res) => {
  if (!req.params || !req.params.foodItemId || !req.params.restaurantSlug) {
    throw new ApiError(400, "Food item ID and restaurant slug are required");
  }

  if (!isValidObjectId(req.params.foodItemId)) {
    throw new ApiError(400, "Invalid food item ID");
  }

  const restaurantSlug = req.params.restaurantSlug;
  const user = req.user;

  if (user!.restaurantIds!.length === 0) {
    throw new ApiError(
      403,
      "You do not have any restaurant associated with your account to update table status"
    );
  }

  let restaurant = null;
  if (user!.role === "owner") {
    restaurant = await Restaurant.findOne({
      slug: restaurantSlug,
      ownerId: user!._id,
    });
  } else if (user!.role === "staff") {
    restaurant = await Restaurant.findOne({
      slug: restaurantSlug,
      staffIds: { $in: [user!._id] },
    });
  } else {
    throw new ApiError(
      403,
      "You do not have permission to toggle table status"
    );
  }

  if (!restaurant || !restaurant._id) {
    throw new ApiError(
      404,
      "Restaurant not found or you do not have permission to toggle table status"
    );
  }

  const foodItem = await FoodItem.findById(req.params.foodItemId);
  if (!foodItem) {
    throw new ApiError(404, "Food item not found");
  }

  if (foodItem.restaurantId.toString() !== restaurant._id!.toString()) {
    throw new ApiError(
      403,
      "This food item does not belong to your restaurant"
    );
  }

  // Toggle availability
  foodItem.isAvailable = !foodItem.isAvailable;

  const updatedFoodItem = await foodItem.save();
  if (!updatedFoodItem) {
    throw new ApiError(500, "Failed to update food item availability");
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedFoodItem,
        `Food item is set to ${updatedFoodItem.isAvailable ? "available" : "not available"}`
      )
    );
});

export const updateFoodItem = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "owner") {
    throw new ApiError(403, "You are not authorized to update food items");
  }

  if (!req.params || !req.params.foodItemId || !req.params.restaurantSlug) {
    throw new ApiError(400, "Food item ID and restaurant slug are required");
  }

  if (!isValidObjectId(req.params.foodItemId)) {
    throw new ApiError(400, "Invalid food item ID");
  }

  // foodName price discountedPrice hasVariants variants imageUrls category foodType description tags
  const restaurant = await Restaurant.findOne({
    slug: req.params.restaurantSlug,
    ownerId: req.user._id,
  });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found or you are not the owner");
  }

  const foodItem = await FoodItem.findById(req.params.foodItemId);

  if (!foodItem) {
    throw new ApiError(404, "Food item not found");
  }

  if (foodItem.restaurantId.toString() !== restaurant._id!.toString()) {
    throw new ApiError(
      403,
      "This food item does not belong to your restaurant"
    );
  }

  if (!req.body || !req.body.foodName || req.body.foodName.trim() === "") {
    throw new ApiError(400, "Food name is required");
  }
  if (!req.body.price || isNaN(req.body.price) || req.body.price < 0) {
    throw new ApiError(400, "Valid price is required");
  }

  const {
    foodName,
    price,
    discountedPrice,
    hasVariants = foodItem.hasVariants,
    variants = foodItem.variants,
    imageUrls = foodItem.imageUrls || [],
    category = foodItem.category,
    foodType = foodItem.foodType,
    description = foodItem.description,
    tags = foodItem.tags || [],
  } = req.body;

  if (foodType && !["veg", "non-veg"].includes(foodType)) {
    throw new ApiError(400, "Food type must be either 'veg' or 'non-veg'");
  }

  if (imageUrls.length > 5) {
    throw new ApiError(
      400,
      "You can only upload a maximum of 5 images for a food item"
    );
  }

  if (!hasVariants && variants.length > 0) {
    throw new ApiError(
      400,
      "Variants should not be provided or should be a empty array when hasVariants is false"
    );
  }
  if (hasVariants && variants.length === 0) {
    throw new ApiError(400, "Variants are required when hasVariants is true");
  }

  if (hasVariants && variants.length > 6) {
    throw new ApiError(400, "You can only create a maximum of 6 food variants");
  }

  // Usage for tags
  if (tags && tags.length > 0 && hasDuplicates(tags)) {
    throw new ApiError(400, "all Tags must be unique.");
  }

  // Usage for variants (assuming each variant has a variantName property)
  if (variants && variants.length > 0) {
    const variantNames = variants.map(
      (v: FoodVariantType) => v.variantName?.trim().toLowerCase() || ""
    );
    if (hasDuplicates(variantNames)) {
      throw new ApiError(400, "All variant names must be unique.");
    }
  }

  // Check if the food item with the same name already exists in the restaurant
  const existingFoodItem = await FoodItem.findOne({
    restaurantId: restaurant._id,
    foodName: { $regex: foodName, $options: "i" }, // Case-insensitive search
    _id: { $ne: foodItem._id }, // Exclude the current food item from the check ($ne means "not equal to")
  });

  if (existingFoodItem) {
    throw new ApiError(
      400,
      "Food item with this name already exists in the restaurant"
    );
  }
  // Update the food item
  foodItem.foodName = foodName;
  foodItem.price = price;
  foodItem.discountedPrice = discountedPrice;
  foodItem.hasVariants = hasVariants;
  foodItem.variants = variants;
  foodItem.imageUrls = imageUrls;
  foodItem.category = category;
  foodItem.foodType = foodType;
  foodItem.description = description;
  foodItem.tags = tags;

  const updatedFoodItem = await foodItem.save();
  if (!updatedFoodItem) {
    throw new ApiError(500, "Failed to update food item");
  }

  // Return the updated food item
  res
    .status(200)
    .json(
      new ApiResponse(200, updatedFoodItem, "Food item updated successfully")
    );
});

export const deleteFoodItem = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "owner") {
    throw new ApiError(403, "You are not authorized to delete food items");
  }

  if (!req.params || !req.params.foodItemId || !req.params.restaurantSlug) {
    throw new ApiError(400, "Food item ID and restaurant slug are required");
  }

  if (!isValidObjectId(req.params.foodItemId)) {
    throw new ApiError(400, "Invalid food item ID");
  }

  const restaurant = await Restaurant.findOne({
    slug: req.params.restaurantSlug,
    ownerId: req.user._id,
  });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found or you are not the owner");
  }

  const foodItem = await FoodItem.findById(req.params.foodItemId);
  if (!foodItem) {
    throw new ApiError(404, "Food item not found");
  }

  if (foodItem.restaurantId.toString() !== restaurant._id!.toString()) {
    throw new ApiError(
      403,
      "This food item does not belong to your restaurant"
    );
  }

  if (foodItem.imageUrls && foodItem.imageUrls.length > 0) {
    for (const imageUrl of foodItem.imageUrls) {
      await cloudinary.delete(imageUrl);
    }
  }

  await foodItem.deleteOne();

  res
    .status(200)
    .json(new ApiResponse(200, null, "Food item deleted successfully"));
});
