import { isValidObjectId, Types } from "mongoose";
import { FoodItem } from "../models/foodItem.model.js";
import { Order } from "../models/order.model.js";
import { Restaurant } from "../models/restaurant.models.js";
import { Table } from "../models/table.model.js";
import { canRestaurantRecieveOrders } from "../service/order.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createOrder = asyncHandler(async (req, res) => {
  if (!req.params.restaurantSlug || !req.params.tableQrSlug) {
    throw new ApiError(400, "Restaurant slug and table QR slug are required");
  }
  if (
    !req.body.foodItems ||
    !Array.isArray(req.body.foodItems) ||
    req.body.foodItems.length === 0 ||
    !req.body.paymentMethod ||
    !["online", "cash"].includes(req.body.paymentMethod)
  ) {
    throw new ApiError(
      400,
      "All fields are required: foodItems, paymentMethod"
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

  let foodItems = [];
  // check if food variants are valid
  for (const foodItem of req.body.foodItems) {
    if (
      !foodItem._id ||
      !foodItem.quantity ||
      typeof foodItem.quantity !== "number"
    ) {
      throw new ApiError(400, "Each food item must have an _id and quantity");
    }
    const isFoodItemValid = await FoodItem.findOne({
      _id: foodItem._id,
      restaurantId: restaurant._id,
      isAvailable: true,
    });
    if (!isFoodItemValid) {
      throw new ApiError(
        400,
        `Food item with id ${foodItem._id} is not available`
      );
    }
    if (foodItem.variantName) {
      if (isFoodItemValid.hasVariants === false) {
        throw new ApiError(
          400,
          `Food item ${foodItem._id} does not have variants`
        );
      }
      const isVariantValid = isFoodItemValid.variants.some(
        (variant) => variant.variantName === foodItem.variantName
      );
      if (!isVariantValid) {
        throw new ApiError(
          400,
          `Variant ${foodItem.variantName} for food item ${foodItem._id} is not valid`
        );
      }
      // Ensure the variant is available
      const variant = isFoodItemValid.variants.find(
        (variant) => variant.variantName === foodItem.variantName
      );
      if (!variant || variant.isAvailable === false) {
        throw new ApiError(
          400,
          `Variant ${foodItem.variantName} for food item ${foodItem._id} is not available`
        );
      }
    }
    foodItems.push({
      foodItemId: isFoodItemValid._id,
      variantName: foodItem.variantName || null, // Ensure variantName is included if provided
      quantity: foodItem.quantity || 1, // Default to 1 if quantity is not provided
      price: foodItem.variantName
        ? isFoodItemValid.variants.filter(
            (variant) => variant.variantName === foodItem.variantName
          )[0].discountedPrice ||
          isFoodItemValid.variants.filter(
            (variant) => variant.variantName === foodItem.variantName
          )[0].price
        : isFoodItemValid.price,
    });
  }

  const table = await Table.findOne({
    qrSlug: req.params.tableQrSlug,
    restaurantId: restaurant._id,
  });

  if (!table) {
    throw new ApiError(404, "Table not found please rescan the QR code");
  }

  if (table.isOccupied) {
    throw new ApiError(
      400,
      "This table is not available for new orders, it is currently occupied"
    );
  }

  await canRestaurantRecieveOrders(restaurant);

  const { paymentMethod, discountAmount, notes, couponUsed } = req.body;
  const totalAmount = foodItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  ); // Calculate total amount from food items
  const order = await Order.create({
    restaurantId: restaurant._id,
    tableId: table._id,
    foodItems,
    status: "pending", // Default status for new orders
    totalAmount,
    couponUsed: couponUsed, // Optional field
    discountAmount: discountAmount, // Optional field
    finalAmount: restaurant.isTaxIncludedInPrice
      ? totalAmount
      : totalAmount + (totalAmount * restaurant.taxRate) / 100, // Calculate final amount including tax if not included in price
    paymentMethod,
    isPaid: false, // Default to false
    notes: notes,
  });

  // Update the table to mark it as occupied and link the current order
  table.isOccupied = true;
  table.currentOrderId = order._id as any; // Type assertion to match the schema
  await table.save({ validateBeforeSave: false });

  res
    .status(201)
    .json(new ApiResponse(201, order, "Order created successfully"));
});

export const getOrderById = asyncHandler(async (req, res) => {
  if (!req.params.orderId || !req.params.restaurantSlug) {
    throw new ApiError(400, "Order ID and restaurant slug are required");
  }
  const restaurantSlug = req.params.restaurantSlug;
  const orderId = req.params.orderId;

  if (!isValidObjectId(orderId)) {
    throw new ApiError(400, "Invalid order ID format");
  }
  const restaurant = await Restaurant.findOne({ slug: restaurantSlug });
  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const order = await Order.aggregate([
    {
      $match: {
        _id: new Types.ObjectId(orderId),
        restaurantId: restaurant._id,
      },
    },
    {
      $lookup: {
        from: "restaurants",
        localField: "restaurantId",
        foreignField: "_id",
        as: "restaurant",
        pipeline: [
          {
            $project: {
              _id: 1,
              restaurantName: 1,
              slug: 1,
              taxRate: 1,
              isTaxIncludedInPrice: 1,
              taxLabel: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$restaurant",
    },
    {
      $lookup: {
        from: "tables",
        localField: "tableId",
        foreignField: "_id",
        as: "table",
        pipeline: [
          {
            $project: {
              _id: 1,
              tableName: 1,
              qrSlug: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$table",
    },
    { $unwind: "$foodItems" },
    // Lookup food item details
    {
      $lookup: {
        from: "fooditems",
        localField: "foodItems.foodItemId",
        foreignField: "_id",
        as: "foodItemDetails",
      },
    },
    // Unwind foodItemDetails (should only be one per foodItemId)
    { $unwind: "$foodItemDetails" },
    // Group back to order structure, but build foodItems array with merged info
    {
      $group: {
        _id: "$_id",
        restaurant: { $first: "$restaurant" },
        table: { $first: "$table" },
        status: { $first: "$status" },
        totalAmount: { $first: "$totalAmount" },
        discountAmount: { $first: "$discountAmount" },
        finalAmount: { $first: "$finalAmount" },
        paymentMethod: { $first: "$paymentMethod" },
        isPaid: { $first: "$isPaid" },
        notes: { $first: "$notes" },
        couponUsed: { $first: "$couponUsed" },
        externalOrderId: { $first: "$externalOrderId" },
        externalPlatform: { $first: "$externalPlatform" },
        kitchenStaffId: { $first: "$kitchenStaffId" },
        customerName: { $first: "$customerName" },
        customerPhone: { $first: "$customerPhone" },
        deliveryAddress: { $first: "$deliveryAddress" },
        createdAt: { $first: "$createdAt" },
        orderedFoodItems: {
          $push: {
            foodItemId: "$foodItems.foodItemId",
            variantName: "$foodItems.variantName",
            quantity: "$foodItems.quantity",
            price: "$foodItems.price",
            foodName: "$foodItemDetails.foodName",
            firstImageUrl: {
              $cond: {
                if: { $gt: [{ $size: "$foodItemDetails.imageUrls" }, 0] },
                then: { $arrayElemAt: ["$foodItemDetails.imageUrls", 0] },
                else: null,
              },
            }, // Get the first image URL if available
            foodType: "$foodItemDetails.foodType",
            // check if the food item is a varinat
            isVariantOrder: {
              $cond: [
                { $ne: [{ $ifNull: ["$foodItems.variantName", ""] }, ""] },
                true,
                false,
              ],
            },
            variantDetails: {
              // Get the variant details if variantName is provided
              $cond: {
                if: { $ne: ["$foodItems.variantName", null] },
                then: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$foodItemDetails.variants",
                        as: "variant",
                        cond: {
                          $eq: [
                            "$$variant.variantName",
                            "$foodItems.variantName",
                          ],
                        },
                      },
                    },
                    0,
                  ],
                },
                else: null,
              },
            },
          },
        },
      },
    },
  ]);

  if (!order || order.length === 0) {
    throw new ApiError(404, "Order not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, order[0], "Order retrieved successfully"));
});

export const getOrdersByRestaurant = asyncHandler(async (req, res) => {
  if (!req.params.restaurantSlug) {
    throw new ApiError(400, "Restaurant slug is required");
  }

  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortType = "desc",
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

  if (req.user?.role === "owner") {
    if (restaurant.ownerId.toString() !== req.user!._id!.toString()) {
      throw new ApiError(
        403,
        "You are not authorized to view orders for this restaurant"
      );
    }
  } else if (req.user?.role === "staff") {
    if (
      !restaurant.staffIds ||
      restaurant.staffIds.length === 0 ||
      !restaurant.staffIds.some(
        (staff) => staff._id.toString() === req.user!._id!.toString()
      )
    ) {
      throw new ApiError(
        403,
        "You are not authorized to view orders for this restaurant"
      );
    }
  }

  const orderCount = await Order.countDocuments({
    restaurantId: restaurant._id,
  });

  let orders = [];
  if (orderCount > 0) {
    orders = await Order.aggregate([
      {
        $match: {
          restaurantId: restaurant._id,
        },
      },
      {
        $sort: {
          [sortBy.toString()]: sortType === "asc" ? 1 : -1, // Sort by the specified field and order
        },
      },
      {
        $skip: (pageNumber - 1) * limitNumber, // Skip to the correct page
      },
      {
        $limit: limitNumber, // Limit the number of results per page
      },
      {
        $lookup: {
          from: "tables",
          localField: "tableId",
          foreignField: "_id",
          as: "table",
          pipeline: [
            {
              $project: {
                _id: 1,
                tableName: 1,
                qrSlug: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$table",
      },
      { $unwind: "$foodItems" },
      // Lookup food item details
      {
        $lookup: {
          from: "fooditems",
          localField: "foodItems.foodItemId",
          foreignField: "_id",
          as: "foodItemDetails",
          pipeline: [
            {
              $project: {
                _id: 1,
                foodName: 1,
                foodType: 1,
              },
            },
          ],
        },
      },
      // Unwind foodItemDetails (should only be one per foodItemId)
      { $unwind: "$foodItemDetails" },
      // Group back to order structure, but build foodItems array with merged info
      {
        $group: {
          _id: "$_id",
          restaurantId: { $first: "$restaurantId" },
          table: { $first: "$table" },
          status: { $first: "$status" },
          finalAmount: { $first: "$finalAmount" },
          isPaid: { $first: "$isPaid" },
          externalPlatform: { $first: "$externalPlatform" },
          createdAt: { $first: "$createdAt" },
          orderedFoodItems: {
            $push: {
              foodItemId: "$foodItems.foodItemId",
              variantName: "$foodItems.variantName",
              foodName: "$foodItemDetails.foodName",
              foodType: "$foodItemDetails.foodType",
              // check if the food item is a varinat
              isVariantOrder: {
                $cond: [
                  { $ne: [{ $ifNull: ["$foodItems.variantName", ""] }, ""] },
                  true,
                  false,
                ],
              },
            },
          },
        },
      },
    ]);
  }

  if (!orders || orders.length === 0) {
    res.status(404).json(
      new ApiResponse(
        200,
        {
          orders: [],
          page: pageNumber,
          limit: limitNumber,
          totalPages: 0,
          totalOrders: orderCount,
        },
        "No orders found for this restaurant"
      )
    );
  } else {
    res.status(200).json(
      new ApiResponse(200, {
        orders,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(orderCount / limitNumber),
        totalOrders: orderCount,
      }, "Orders retrieved successfully")
    );
  }
});

export const getOrderByTable = asyncHandler(async (req, res) => {
  if (!req.params.restaurantSlug || !req.params.tableQrSlug) {
    throw new ApiError(400, "Restaurant slug and table QR slug are required");
  }

   const restaurant = await Restaurant.findOne({
    slug: req.params.restaurantSlug,
  });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  if (req.user?.role === "owner") {
    if (restaurant.ownerId.toString() !== req.user!._id!.toString()) {
      throw new ApiError(
        403,
        "You are not authorized to view orders for this restaurant"
      );
    }
  } else if (req.user?.role === "staff") {
    if (
      !restaurant.staffIds ||
      restaurant.staffIds.length === 0 ||
      !restaurant.staffIds.some(
        (staff) => staff._id.toString() === req.user!._id!.toString()
      )
    ) {
      throw new ApiError(
        403,
        "You are not authorized to view orders for this restaurant"
      );
    }
  } else {
    throw new ApiError(
      403,
      "You are not authorized to view orders for this restaurant"
    );
  }

  const table = await Table.findOne({ restaurantId: restaurant._id, qrSlug: req.params.tableQrSlug });

  if (!table) {
    throw new ApiError(404, "Table not found");
  }

  if (!table.currentOrderId) {
    throw new ApiError(404, "No current order found for this table");
  }

  const order = await Order.aggregate([
    {
      $match: {
        _id: table.currentOrderId,
        restaurantId: restaurant._id,
        tableId: table._id,
      }
    }, {
      $lookup: {
        from: "tables",
        localField: "tableId",
        foreignField: "_id",
        as: "table",
        pipeline: [
          {
            $project: {
              _id: 1,
              tableName: 1,
              qrSlug: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$table",
    },
    { $unwind: "$foodItems" },
    // Lookup food item details
    {
      $lookup: {
        from: "fooditems",
        localField: "foodItems.foodItemId",
        foreignField: "_id",
        as: "foodItemDetails",
        pipeline: [
          {
            $project: {
              _id: 1,
              foodName: 1,
              foodType: 1,
            },
          },
        ],
      },
    },
    // Unwind foodItemDetails (should only be one per foodItemId)
    { $unwind: "$foodItemDetails" },
    // Group back to order structure, but build foodItems array with merged info
    {
      $group: {
        _id: "$_id",
        restaurantId: { $first: "$restaurantId" },
        table: { $first: "$table" },
        status: { $first: "$status" },
        finalAmount: { $first: "$finalAmount" },
        paymentMethod: { $first: "$paymentMethod" },
        isPaid: { $first: "$isPaid" },
        externalPlatform: { $first: "$externalPlatform" },
        createdAt: { $first: "$createdAt" },
        orderedFoodItems: {
          $push: {
            foodItemId: "$foodItems.foodItemId",
            variantName: "$foodItems.variantName",
            foodName: "$foodItemDetails.foodName",
            foodType: "$foodItemDetails.foodType",
            // check if the food item is a varinat
            isVariantOrder: {
              $cond: [
                { $ne: [{ $ifNull: ["$foodItems.variantName", ""] }, ""] },
                true,
                false,
              ],
            },
          },
        },
      }
    }
  ])

  if (!order || order.length === 0) {
    throw new ApiError(404, "No orders found for this table");
  }

  res
    .status(200)
    .json(new ApiResponse(200, order[0], "Order retrieved successfully"));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  if (!req.params.orderId || !req.params.restaurantSlug) {
    throw new ApiError(400, "Order ID and restaurant slug are required");
  }

  if ( !req.body || !req.body.status) {
    throw new ApiError(400, "Status is required");
  }

  const { status } = req.body;

  if (!status || !["pending", "preparing", "ready", "served", "completed", "cancelled"].includes(status)) {
    throw new ApiError(400, "Valid status is required");
  }

  const restaurant = await Restaurant.findOne({ slug: req.params.restaurantSlug });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  if (req.user?.role === "owner") {
    if (restaurant.ownerId.toString() !== req.user!._id!.toString()) {
      throw new ApiError(
        403,
        "You are not authorized to update orders for this restaurant"
      );
    }
  } else if (req.user?.role === "staff") {
    if (
      !restaurant.staffIds ||
      restaurant.staffIds.length === 0 ||
      !restaurant.staffIds.some(
        (staff) => staff._id.toString() === req.user!._id!.toString()
      )
    ) {
      throw new ApiError(
        403,
        "You are not authorized to update orders for this restaurant"
      );
    }
  } else {
    throw new ApiError(
      403,
      "You are not authorized to update orders for this restaurant"
    );
  }

  const order = await Order.findOne(
    { _id: req.params.orderId, restaurantId: restaurant._id }
  );

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check if the status is already set to the requested status
  if (order.status === status) {
    throw new ApiError(400, `Order status is already set to ${status}`);
  }

  // Check if the staff is the one who updated the order before
  if(order.kitchenStaffId && order.kitchenStaffId.toString() !== req.user!._id!.toString()) {
    throw new ApiError(403, "Only the kitchen staff who updated the order can change its status");
  }

  // Check if the order status can be updated
  if (["completed", "cancelled"].includes(order.status)) {
    throw new ApiError(400, "Cannot update status of completed or cancelled orders");
  }

  // Update the order status
  order.status = status;
  if (status === "completed") {
    order.isPaid = true; // Automatically mark as paid if completed
  }
  order.kitchenStaffId = req.user?._id as any; // Set the kitchen staff who updated the order status
  await order.save();
  // If the order is completed, update the table status
  if (status === "completed" || status === "cancelled") {
    const table = await Table.findOne({ _id: order.tableId });
    if (table) {
      table.isOccupied = false; // Mark the table as not occupied
      table.currentOrderId = undefined; // Clear the current order
      await table.save({ validateBeforeSave: false });
    }
  }

  res.status(200).json(new ApiResponse(200, order, "Order status updated successfully"));
});