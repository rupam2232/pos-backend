import { nanoid } from "nanoid";
import { Restaurant } from "../models/restaurant.models";
import { Table } from "../models/table.model";
import { canCreateTable } from "../service/table.service";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export const createTable = asyncHandler(async (req, res) => {
  if (!req.body.restaurantId || !req.body.tableName) {
    throw new ApiError(
      400,
      "restaurantId and tableName are required."
    );
  }

  const { restaurantId, tableName, seatCount } = req.body;
  const user = req.user;
  if (user!.role !== "owner") {
    throw new ApiError(403, "You do not have permission to create a table.");
  }

  if (user!.restaurantIds!.length === 0) {
    throw new ApiError(
      403,
      "You do not have any restaurants to create a table for."
    );
  }
  const restaurant = Restaurant.findOne({
    _id: restaurantId,
    ownerId: user!._id,
  });
  if (!restaurant) {
    throw new ApiError(
      404,
      "Restaurant not found or you do not own this restaurant."
    );
  }

  await canCreateTable(user!, restaurantId);

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
        seatCount
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
    throw new ApiError(500, "Failed to create table. Please try again.");
  }
  res
    .status(201)
    .json(new ApiResponse(201, table, "Table created successfully"));
});
