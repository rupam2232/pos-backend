import { isValidObjectId, Types } from "mongoose";
import { FoodItem } from "../models/foodItem.model.js";
import { Order } from "../models/order.model.js";
import { Restaurant } from "../models/restaurant.models.js";
import { Table } from "../models/table.model.js";
import { canRestaurantRecieveOrders } from "../service/order.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { razorpay } from "../utils/razorpay.js";
import { Payment } from "../models/payment.model.js";
import { startSession } from "mongoose";

export const createOrder = asyncHandler(async (req, res, next) => {
  const session = await startSession();
  session.startTransaction();
  try {
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
    }).session(session);

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
      }).session(session);
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
    }).session(session);

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

    const { paymentMethod, notes } = req.body;

    const currency = "INR"; // Default currency for payments, can be changed based on requirements

    if (paymentMethod !== "online" && paymentMethod !== "cash") {
      throw new ApiError(
        400,
        "Invalid payment method. Must be 'online' or 'cash'"
      );
    }

    // Calculate total amount from food items
    const subtotal = foodItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    ); // Calculate total amount from food items
    const order = await Order.create([{
      restaurantId: restaurant._id,
      tableId: table._id,
      foodItems,
      status: "pending", // Default status for new orders
      isPaid: false, // Default to false
      notes: notes,
    }], { session });

    const payment = new Payment({
      orderId: order[0]._id,
      method: paymentMethod,
      status: "pending", // Initial status for new payments
      subtotal,
      totalAmount: restaurant.isTaxIncludedInPrice
        ? subtotal
        : subtotal + (subtotal * restaurant.taxRate) / 100, // Calculate total amount including tax if not included in price
      discountAmount: 0, // Assuming no discount for now, can be updated later
      taxAmount: restaurant.isTaxIncludedInPrice
        ? 0
        : (subtotal * restaurant.taxRate) / 100,
      tipAmount: 0, // Assuming no tip for now, can be updated later
    });

    // Update the table to mark it as occupied and link the current order
    table.isOccupied = true;
    table.currentOrderId = order[0]._id as Types.ObjectId; // Link the current order to the table
    await table.save({ validateBeforeSave: false, session });

    // If the payment method is online, we can initiate the payment process here
    if (paymentMethod === "online") {
      // Razorpay integration to create a payment order
      const paymentResponse = await razorpay.orders.create({
        amount: payment.totalAmount * 100, // Amount in paise
        currency: currency,
        receipt: `Receipt #${order[0]._id}`,
        notes: {
          orderId: order[0]._id!.toString(),
          restaurantSlug: restaurant.slug,
        },
      });
      if (!paymentResponse || !paymentResponse.id) {
        throw new ApiError(500, "Failed to create payment order");
      }
      payment.paymentGateway = "Razorpay"; // Set the payment gateway
      payment.gatewayOrderId = paymentResponse.id; // Store the Razorpay order ID
      const paymentData = await payment.save({ session });
      // Update the order with the payment ID
      // order.paymentAttempts = [payment._id]; // Add the payment ID to the order's payment attempts
      order[0].paymentAttempts = order[0].paymentAttempts || []; // Ensure paymentAttempts is an array
      order[0].paymentAttempts.push(paymentData._id as Types.ObjectId); // Add the payment ID to the order's payment attempts
      await order[0].save({ session });
      await session.commitTransaction();
      session.endSession();
      res
        .status(201)
        .json(
          new ApiResponse(
            201,
            { order, paymentData: paymentResponse },
            "Order created successfully"
          )
        );
    } else {
      // If payment method is cash, create the payment record without payment gateway
      const paymentData = await payment.save({ session });
      order[0].paymentAttempts = order[0].paymentAttempts || []; // Ensure paymentAttempts is an array
      order[0].paymentAttempts.push(paymentData._id as Types.ObjectId); // Add the payment ID to the order's payment attempts
      await order[0].save({ session });
      // For cash payments
      await session.commitTransaction();
      session.endSession();
      res
        .status(201)
        .json(new ApiResponse(201, { order }, "Order created successfully"));
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error); // asyncHandler will catch and forward this error
  }
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
        isPaid: { $first: "$isPaid" },
        notes: { $first: "$notes" },
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
      new ApiResponse(
        200,
        {
          orders,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(orderCount / limitNumber),
          totalOrders: orderCount,
        },
        "Orders retrieved successfully"
      )
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

  const table = await Table.findOne({
    restaurantId: restaurant._id,
    qrSlug: req.params.tableQrSlug,
  });

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
      },
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

  if (!req.body || !req.body.status) {
    throw new ApiError(400, "Status is required");
  }

  const { status } = req.body;

  if (
    !status ||
    ![
      "pending",
      "preparing",
      "ready",
      "served",
      "completed",
      "cancelled",
    ].includes(status)
  ) {
    throw new ApiError(400, "Valid status is required");
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

  const order = await Order.findOne({
    _id: req.params.orderId,
    restaurantId: restaurant._id,
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check if the status is already set to the requested status
  if (order.status === status) {
    throw new ApiError(400, `Order status is already set to ${status}`);
  }

  // Check if the staff is the one who updated the order before
  if (
    order.kitchenStaffId &&
    order.kitchenStaffId.toString() !== req.user!._id!.toString()
  ) {
    throw new ApiError(
      403,
      "Only the kitchen staff who updated the order can change its status"
    );
  }

  // Check if the order status can be updated
  if (["completed", "cancelled"].includes(order.status)) {
    throw new ApiError(
      400,
      "Cannot update status of completed or cancelled orders"
    );
  }

  // Update the order status
  order.status = status;
  if (status === "completed") {
    order.isPaid = true; // Automatically mark as paid if completed
  }
  order.kitchenStaffId = req.user?._id as Types.ObjectId; // Set the kitchen staff who updated the order status
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

  res
    .status(200)
    .json(new ApiResponse(200, order, "Order status updated successfully"));
});

export const updateOrder = asyncHandler(async (req, res, next) => {
    const session = await startSession();
  session.startTransaction();
try {
    if (!req.params.orderId || !req.params.restaurantSlug) {
      throw new ApiError(400, "Order ID and restaurant slug are required");
    }
  
    if (!req.body || !req.body.foodItems) {
      throw new ApiError(400, "Food items are required");
    }
  
    const { foodItems, notes } = req.body;
  
    if (!foodItems || !Array.isArray(foodItems) || foodItems.length === 0) {
      throw new ApiError(400, "Food items are required");
    }
  
    const restaurant = await Restaurant.findOne({
      slug: req.params.restaurantSlug,
    }).session(session);
  
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
  
    const order = await Order.findOne({
      _id: req.params.orderId,
      restaurantId: restaurant._id,
    }).session(session);
  
    if (!order) {
      throw new ApiError(404, "Order not found");
    }
  
    // Check if the order is already completed or cancelled
    if (["ready", "served", "completed", "cancelled"].includes(order.status)) {
      throw new ApiError(
        400,
        "Cannot update order that is already completed or cancelled"
      );
    }
  
    // Validate food items
    let updatedFoodItems = [];
    for (const foodItem of foodItems) {
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
      }).session(session);
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
      updatedFoodItems.push({
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
    // Update the order with new food items and notes
    order.foodItems = updatedFoodItems as typeof order.foodItems;
  
    order.notes = notes || order.notes; // Update notes if provided, otherwise keep existing notes
    await order.save({ session });
  
    const subtotal = updatedFoodItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    ); // Calculate total amount from food items
  
    await Payment.updateMany(
      {
        orderId: order._id,
        status: "pending", // Update only pending payments
      },
      {
        subtotal,
        totalAmount: restaurant.isTaxIncludedInPrice
          ? subtotal
          : subtotal + (subtotal * restaurant.taxRate) / 100, // Calculate total amount including tax if not included in price
        taxAmount: restaurant.isTaxIncludedInPrice
          ? 0
          : (subtotal * restaurant.taxRate) / 100, // Calculate tax amount if not included in price
        discountAmount: 0, // Assuming no discount for now, can be updated later
        tipAmount: 0, // Assuming no tip for now, can be updated later
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();
  
    res
      .status(200)
      .json(new ApiResponse(200, order, "Order updated successfully"));
} catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error); // asyncHandler will catch and forward this error
}
});
