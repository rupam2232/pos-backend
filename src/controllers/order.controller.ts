import { Order } from "../models/order.model.js";
import { Restaurant } from "../models/restaurant.models.js";
import { Table } from "../models/table.model.js";
import { canRestaurantRecieveOrders } from "../service/order.service.js";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createOrder = asyncHandler(async (req, res) => {
  if (!req.params.restaurantSlug || !req.params.tableQrSlug) {
    throw new ApiError(400, "Restaurant slug and table QR slug are required");
  }
  if (
    !req.body.foodItems ||
    req.body.foodItems.length === 0 ||
    !req.body.paymentMethod ||
    !req.body.totalAmount ||
    !req.body.finalAmount
  ) {
    throw new ApiError(
      400,
      "All fields are required: foodItems, paymentMethod, totalAmount, finalAmount"
    );
  }

  const restaurant = await Restaurant.findOne({
    slug: req.params.restaurantSlug,
  });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  if (restaurant.isCurrentlyOpen === false) {
    throw new ApiError(400, "Restaurant is currently closed");
  }

  const table = await Table.findOne({
    qrSlug: req.params.tableQrSlug,
    restaurantId: restaurant._id,
  });

  if (!table) {
    throw new ApiError(404, "Table not found please rescan the QR code");
  }

  await canRestaurantRecieveOrders(restaurant);

  const { foodItems, paymentMethod, totalAmount, discountAmount, finalAmount, notes } = req.body;

  const order = await Order.create({
    restaurantId: restaurant._id,
    tableId: table._id,
    foodItems,
    status: "pending", // Default status for new orders
    totalAmount,
    discountAmount: discountAmount || undefined, // Optional field
    finalAmount: finalAmount || totalAmount, // If finalAmount is not provided, use totalAmount
    paymentMethod,
    isPaid: false, // Default to false
    notes: notes
  })

  res.status(201).json(new ApiResponse(
    201,
    order,
    "Order created successfully",
  ));
});
