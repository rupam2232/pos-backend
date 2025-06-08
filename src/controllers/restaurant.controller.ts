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
    logoUrl,
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

export const getRestaurantBySlug = asyncHandler(async (req, res) => {
  if (!req.params?.slug) {
    throw new ApiError(400, "Restaurant slug is required.");
  }
  const { slug } = req.params;
  if (!slug) {
    throw new ApiError(400, "Restaurant slug is required.");
  }

  const restaurant = await Restaurant.findOne({ slug });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found.");
  }
  res
    .status(200)
    .json(new ApiResponse(200, restaurant, "Restaurant fetched successfully"));
});

export const updateRestaurantDetails = asyncHandler(async (req, res) => {
  if (!req.params?.slug) {
    throw new ApiError(400, "Restaurant slug is required.");
  }
  const { slug } = req.params;
  if (!req.body?.restaurantName || !req.body?.newSlug) {
    throw new ApiError(400, "Restaurant name and address are required.");
  }
  if (req.user!.role !== "owner") {
    throw new ApiError(403, "Only owners can update restaurant details.");
  }

  const {
    restaurantName,
    newSlug,
    description,
    address,
    logoUrl,
    openingTime,
    closingTime,
  } = req.body;

  if (
    (closingTime && closingTime.match(/^\d{2}:\d{2}$/) === null) ||
    (openingTime && openingTime?.match(/^\d{2}:\d{2}$/) === null)
  ) {
    throw new ApiError(
      400,
      "openingTime and closingTime must be in HH:MM format (24-hour clock)."
    );
  }

  if (closingTime || openingTime) {
    if (!openingTime || !closingTime) {
      throw new ApiError(
        400,
        "Both opening and closing times must be provided or neither."
      );
    }
  }

  if(logoUrl && typeof logoUrl !== "string") {
    throw new ApiError(400, "logoUrl must be a string.");
  }

  if(logoUrl && (new URL(logoUrl)?.origin !== process.env.MEDIA_ORIGIN || new URL(logoUrl)?.pathname?.split("/")[1] !== process.env.MEDIA_PATH_NAME)) {
    throw new ApiError(400, "logoUrl must be a valid URL.");
  }

  const restaurant = await Restaurant.findOneAndUpdate(
    { slug, ownerId: req.user!._id },
    {
      $set: {
        restaurantName,
        slug: newSlug,
        description: description ? description : null,
        address: address ? address : null,
        logoUrl: logoUrl ? logoUrl : null,
        openingTime: openingTime ? openingTime : null,
        closingTime: closingTime ? closingTime : null,
      },
    },
    { new: true, runValidators: true }
  );

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found or you are not the owner.");
  }
  res
    .status(200)
    .json(new ApiResponse(200, restaurant, "Restaurant updated successfully"));
});

export const toggleRestaurantOpenStatus = asyncHandler(async (req, res) => {
  if (!req.params?.slug) {
    throw new ApiError(400, "Restaurant slug is required.");
  }
  const { slug } = req.params;
  if (req.user!.role !== "owner") {
    throw new ApiError(403, "Only owners can toggle restaurant status.");
  }

  const restaurant = await Restaurant.findOne({ slug, ownerId: req.user!._id });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found or you are not the owner.");
  }

  restaurant.isCurrentlyOpen = !restaurant.isCurrentlyOpen;
  await restaurant.save();

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        restaurant,
        `Restaurant is now ${restaurant.isCurrentlyOpen ? "open" : "closed"}`
      )
    );
});

export const createRestaurantCategories = asyncHandler(async (req, res) => {
  if (!req.params?.slug) {
    throw new ApiError(400, "Restaurant slug is required.");
  }
  const { slug } = req.params;
  if (!req.body?.categories || !Array.isArray(req.body.categories)) {
    throw new ApiError(400, "Categories must be an array.");
  }
  if (req.user!.role !== "owner") {
    throw new ApiError(403, "Only owners can create restaurant categories.");
  }

  const restaurant = await Restaurant.findOneAndUpdate(
    { slug, ownerId: req.user!._id },
    { $set: { categories: req.body.categories } },
    { new: true, runValidators: true }
  );
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found or you are not the owner.");
  }

  res
    .status(200)
    .json(new ApiResponse(200, restaurant, "Categories created successfully"));
});

export const removeRestaurantCategories = asyncHandler(async (req, res) => {
  if (!req.params?.slug) {
    throw new ApiError(400, "Restaurant slug is required.");
  }
  const { slug } = req.params;
  if (!req.body?.categories || !Array.isArray(req.body.categories)) {
    throw new ApiError(400, "Categories must be an array.");
  }
  const { categories } = req.body;
  if (categories.length === 0) {
    throw new ApiError(
      400,
      "At least one category must be provided to remove."
    );
  }
  if (req.user!.role !== "owner") {
    throw new ApiError(403, "Only owners can remove restaurant categories.");
  }
  const restaurant = await Restaurant.findOneAndUpdate(
    { slug, ownerId: req.user!._id },
    { $pull: { categories: { $in: categories } } },
    { new: true, runValidators: true }
  );

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found or you are not the owner.");
  }
  res
    .status(200)
    .json(new ApiResponse(200, restaurant, "Categories removed successfully"));
});

export const setRestaurantTax = asyncHandler(async (req, res) => {
  if (!req.params?.slug) {
    throw new ApiError(400, "Restaurant slug is required");
  }
  const { slug } = req.params;

  if (req.user!.role !== "owner") {
    throw new ApiError(403, "Only owners can set restaurant tax");
  }

  if (typeof req.body?.isTaxIncludedInPrice !== "boolean") {
    throw new ApiError(400, "define whether tax is included in price");
  }

  const { isTaxIncludedInPrice, taxLabel, taxRate } = req.body;

  if ((taxRate && typeof taxRate !== "number") || taxRate < 0) {
    throw new ApiError(400, "Tax rate must be a non-negative number");
  }

  if (taxRate && (!taxLabel || typeof taxLabel !== "string")) {
    throw new ApiError(400, "Tax label is required and must be a string");
  }

  if (
    isTaxIncludedInPrice &&
    ((taxLabel && taxLabel.trim() !== "") || (taxRate && taxRate !== 0))
  ) {
    throw new ApiError(
      400,
      "If tax is included in price, tax label and rate should not be provided"
    );
  }

  const restaurant = await Restaurant.findOneAndUpdate(
    { slug, ownerId: req.user!._id },
    {
      $set: {
        taxRate: isTaxIncludedInPrice ? 0 : taxRate,
        taxLabel: taxLabel ? taxLabel : null,
        isTaxIncludedInPrice: isTaxIncludedInPrice,
      },
    },
    { new: true, runValidators: true }
  );
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found or you are not the owner");
  }

  res
    .status(200)
    .json(new ApiResponse(200, restaurant, "Tax set successfully"));
});

export const checkUniqueRestaurantSlug = asyncHandler(async (req, res) => {
  if (!req.params?.slug) {
    throw new ApiError(400, "Restaurant slug is required.");
  }
  const { slug } = req.params;

  const restaurant = await Restaurant.findOne({ slug });
  if (restaurant) {
    res
      .status(200)
      .json(new ApiResponse(200, false, `${slug} slug is not available`));
  } else {
    res
      .status(200)
      .json(new ApiResponse(200, true, `${slug} slug is unique and available`));
  }
});
