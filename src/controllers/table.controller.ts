import { nanoid } from "nanoid";
import { Restaurant } from "../models/restaurant.models.js";
import { Table } from "../models/table.model.js";
import { canCreateTable } from "../service/table.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createTable = asyncHandler(async (req, res) => {
  if (!req.body || !req.body.tableName) {
    throw new ApiError(400, "tableName is required");
  }

  if (!req.params || !req.params.restaurantSlug) {
    throw new ApiError(400, "restaurantSlug is required");
  }

  const restaurantSlug = req.params.restaurantSlug;

  const { tableName, seatCount } = req.body;
  const user = req.user;
  if (user!.role !== "owner") {
    throw new ApiError(403, "You do not have permission to create a table");
  }

  if (user!.restaurantIds!.length === 0) {
    throw new ApiError(
      403,
      "You do not have any restaurants to create a table for"
    );
  }

  if (seatCount && Math.ceil(seatCount) < 1 || Math.ceil(seatCount) > 40) {
    throw new ApiError(400, "Seat count must be between 1 and 40");
  }

  const restaurant = await Restaurant.findOne({
    slug: restaurantSlug,
    ownerId: user!._id,
  });
  if (!restaurant) {
    throw new ApiError(
      404,
      "Restaurant not found or you do not own this restaurant"
    );
  }

  const restaurantId = restaurant._id!.toString();
  await canCreateTable(req.subscription!, restaurantId);

  // Try to create a unique qrSlug, retry if duplicate key error
  let table;
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    try {
      const qrSlug = `${restaurantId.slice(-4)}-${nanoid(4)}`;
      table = await Table.create({
        restaurantId,
        tableName,
        qrSlug,
        seatCount: Math.ceil(seatCount),
      });
      break; // Success, exit loop
    } catch (err: any) {
      // 11000 is MongoDB duplicate key error code
      if (err.code === 11000 && err.keyPattern && err.keyPattern.qrSlug) {
        attempts++;
        // Try again with a new qrSlug
        continue;
      }
      // Other errors, rethrow
      throw err;
    }
  }

  if (!table) {
    throw new ApiError(500, "Failed to create table. Please try again");
  }
  res
    .status(201)
    .json(new ApiResponse(201, table, "Table created successfully"));
});

export const updateTable = asyncHandler(async (req, res) => {
  if (!req.body || !req.body.tableName || req.body.seatCount === undefined) {
    throw new ApiError(400, "tableName and seatCount is required");
  }
  if (!req.params || !req.params.qrSlug || !req.params.restaurantSlug) {
    throw new ApiError(400, "qrSlug and restaurantSlug is required");
  }
  const qrSlug = req.params.qrSlug;
  const restaurantSlug = req.params.restaurantSlug;

  const { tableName, seatCount } = req.body;
  const user = req.user;

  if (user!.role !== "owner") {
    throw new ApiError(403, "You do not have permission to update a table");
  }

  if (user!.restaurantIds!.length === 0) {
    throw new ApiError(
      403,
      "You do not have any restaurants to update a table for"
    );
  }

  if (seatCount && Math.ceil(seatCount) < 1 || Math.ceil(seatCount) > 40) {
    throw new ApiError(400, "Seat count must be between 1 and 40");
  }

  const restaurant = await Restaurant.findOne({
    slug: restaurantSlug,
    ownerId: user!._id,
  });

  if (!restaurant) {
    throw new ApiError(
      404,
      "Restaurant not found or you do not own this restaurant"
    );
  }

  const table = await Table.findOneAndUpdate(
    { qrSlug, restaurantId: restaurant?._id },
    { $set: { tableName, seatCount: Math.ceil(seatCount) } },
    { new: true }
  );

  if (!table) {
    throw new ApiError(404, "Table not found or you do not own this table");
  }

  res
    .status(200)
    .json(new ApiResponse(200, table, "Table updated successfully"));
});

export const toggleOccupiedStatus = asyncHandler(async (req, res) => {
  if (!req.params || !req.params.qrSlug || !req.params.restaurantSlug) {
    throw new ApiError(400, "qrSlug and restaurantSlug are required");
  }
  const qrSlug = req.params.qrSlug;
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

  // Check if the table exists and belongs to the user's restaurant
  const table = await Table.findOne({
    qrSlug,
    restaurantId: restaurant._id,
  });

  if (!table) {
    throw new ApiError(
      404,
      "Table not found or you do not have permission to update this table"
    );
  }

  if (table.isOccupied && table.currentOrderId) {
    throw new ApiError(
      400,
      "Cannot toggle occupied status while an order is active"
    );
  }

  table.isOccupied = !table.isOccupied;
  await table.save({ validateBeforeSave: false });

  res
    .status(200)
    .json(
      new ApiResponse(200, table, "Table occupied status updated successfully")
    );
});

export const getTableBySlug = asyncHandler(async (req, res) => {
  if (!req.params || !req.params.qrSlug || !req.params.restaurantSlug) {
    throw new ApiError(400, "qr slug and restaurant slug is required");
  }
  const { qrSlug, restaurantSlug } = req.params;
  const restaurant = await Restaurant.findOne({ slug: restaurantSlug });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  let canViewOrder = false;
  if (req.user) {
    // If user is authenticated, check if they are the owner or staff of the restaurant
    if (
      req.user.role === "owner" &&
      restaurant.ownerId.toString() === req.user._id!.toString()
    ) {
      canViewOrder = true;
    } else if (
      req.user.role === "staff" &&
      restaurant.staffIds!.length > 0 &&
      restaurant
        .staffIds!.map((id) => id.toString())
        .includes(req.user._id!.toString())
    ) {
      canViewOrder = true;
    }
  }

  const table = await Table.aggregate([
    {
      $match: {
        qrSlug,
        restaurantId: restaurant._id,
      },
    },
    {
      $lookup: {
        from: "restaurants",
        localField: "restaurantId",
        foreignField: "_id",
        as: "restaurantDetails",
      },
    },
    { $unwind: "$restaurantDetails" },
    {
      $lookup: {
        from: "orders",
        localField: "currentOrderId",
        foreignField: "_id",
        as: "currentOrder",
      },
    },
    {
      $unwind: {
        path: "$currentOrder",
        preserveNullAndEmptyArrays: true, // In case there's no current order
      },
    },
    {
      $project: {
        tableName: 1,
        seatCount: 1,
        isOccupied: 1,
        qrSlug: 1,
        currentOrderId: 1,
        currentOrder: canViewOrder
          ? {
              status: "$currentOrder.status",
              finalAmount: "$currentOrder.finalAmount",
              foodItems: "$currentOrder.foodItems",
            }
          : "$$REMOVE",
        restaurantDetails: {
          restaurantName: "$restaurantDetails.restaurantName",
          address: "$restaurantDetails.address",
          slug: "$restaurantDetails.slug",
        },
      },
    },
  ]);

  if (!table || table.length === 0) {
    throw new ApiError(404, "Table not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, table[0], "Table details fetched successfully"));
});

export const getAllTablesOfRestaurant = asyncHandler(async (req, res) => {
  if (!req.params || !req.params.restaurantSlug) {
    throw new ApiError(400, "restaurantId is required");
  }
  const restaurantSlug = req.params.restaurantSlug;

  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortType = "asc",
  } = req.query;

  const pageNumber = parseInt(page.toString());
  const limitNumber = parseInt(limit.toString());

  if (pageNumber < 1 || limitNumber < 1) {
    throw new ApiError(400, "Page and limit must be positive integers");
  }

  const user = req.user;

  const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  if (
    user!.role === "owner" &&
    restaurant.ownerId.toString() !== user!._id!.toString()
  ) {
    throw new ApiError(
      403,
      "You do not have permission to view this restaurant's tables"
    );
  } else if (
    user!.role === "staff" &&
    !restaurant
      .staffIds!.map((id) => id.toString())
      .includes(user!._id!.toString())
  ) {
    throw new ApiError(
      403,
      "You do not have permission to view this restaurant's tables"
    );
  }
  // Fetch all tables for the restaurant
  const tables = await Table.find({ restaurantId: restaurant._id })
    .sort({
      [sortBy.toString()]: sortType === "asc" ? 1 : -1, // Ascending or descending sort
    })
    .skip((pageNumber - 1) * limitNumber) // Pagination logic
    .limit(limitNumber) // Limit the number of results
    .select("-restaurantId -__v"); // Exclude restaurantId and __v fields

  if (!tables || tables.length === 0) {
    res
      .status(404)
      .json(new ApiResponse(404, {
        tables: [],
        page: pageNumber,
        limit: limitNumber,
        totalPages: 0,
        totalCount: 0,
      }, "No tables found for this restaurant"));
  } else {
    const tableCount = await Table.countDocuments({
      restaurantId: restaurant._id,
    });
    const totalPages = Math.ceil(tableCount / limitNumber);
    res
      .status(200)
      .setHeader("X-Total-Count", tableCount.toString())
      .setHeader("X-Total-Pages", totalPages.toString())
      .json(
        new ApiResponse(
          200,
          {
            tables,
            page: pageNumber,
            limit: limitNumber,
            totalPages,
            totalCount: tableCount,
          },
          "Restaurant tables fetched successfully"
        )
      );
  }
});

export const deleteTable = asyncHandler(async (req, res) => {
  if (!req.params || !req.params.qrSlug || !req.params.restaurantSlug) {
    throw new ApiError(400, "qrSlug and restaurantSlug are required");
  }
  const qrSlug = req.params.qrSlug;
  const restaurantSlug = req.params.restaurantSlug;

  const user = req.user;

  if (user!.role !== "owner") {
    throw new ApiError(403, "You do not have permission to delete a table");
  }

  const restaurant = await Restaurant.findOne({
    slug: restaurantSlug,
    ownerId: user!._id,
  });

  if (!restaurant) {
    throw new ApiError(
      404,
      "Restaurant not found or you do not own this restaurant"
    );
  }

  const table = await Table.findOneAndDelete({
    qrSlug,
    restaurantId: restaurant._id,
  });

  if (!table) {
    throw new ApiError(404, "Table not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Table deleted successfully"));
});