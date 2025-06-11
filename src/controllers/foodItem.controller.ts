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

  res.status(200).json(new ApiResponse(200, foodItem, "Food item fetched successfully"));
});