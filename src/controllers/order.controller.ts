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
    if (!foodItem._id || !foodItem.quantity || typeof foodItem.quantity !== "number") {
      throw new ApiError(400, "Each food item must have an _id and quantity");
    }
    const isFoodItemValid = await FoodItem.findOne({
      _id: foodItem._id,
      restaurantId: restaurant._id,
      isAvailable: true,
    })
    if (!isFoodItemValid) {
      throw new ApiError(400, `Food item with id ${foodItem._id} is not available`);
    }
    if(foodItem.variantName){
      if (isFoodItemValid.hasVariants === false) {
        throw new ApiError(400, `Food item ${foodItem._id} does not have variants`);
      }
      const isVariantValid = isFoodItemValid.variants.some(variant => variant.variantName === foodItem.variantName);
      if (!isVariantValid) {
        throw new ApiError(400, `Variant ${foodItem.variantName} for food item ${foodItem._id} is not valid`);
      }
      // Ensure the variant is available
      const variant = isFoodItemValid.variants.find(variant => variant.variantName === foodItem.variantName);
      if ( !variant || variant.isAvailable === false) {
        throw new ApiError(400, `Variant ${foodItem.variantName} for food item ${foodItem._id} is not available`);
      }
    }
    foodItems.push({
      foodItemId: isFoodItemValid._id,
      variantName: foodItem.variantName || null, // Ensure variantName is included if provided
      quantity: foodItem.quantity || 1, // Default to 1 if quantity is not provided
      price: foodItem.variantName ? isFoodItemValid.variants.filter(variant => variant.variantName === foodItem.variantName)[0].discountedPrice || isFoodItemValid.variants.filter(variant => variant.variantName === foodItem.variantName)[0].price : isFoodItemValid.price,
    });
  }

  const table = await Table.findOne({
    qrSlug: req.params.tableQrSlug,
    restaurantId: restaurant._id,
  });

  if (!table) {
    throw new ApiError(404, "Table not found please rescan the QR code");
  }

  if(table.isOccupied){
    throw new ApiError(400, "This table is not available for new orders, it is currently occupied");
  }

  await canRestaurantRecieveOrders(restaurant);

  const { paymentMethod, discountAmount, notes, couponUsed } = req.body;
const totalAmount = foodItems.reduce((acc, item) => acc + item.price * item.quantity, 0) // Calculate total amount from food items
  const order = await Order.create({
    restaurantId: restaurant._id,
    tableId: table._id,
    foodItems,
    status: "pending", // Default status for new orders
    totalAmount,
    couponUsed: couponUsed, // Optional field
    discountAmount: discountAmount, // Optional field
    finalAmount: restaurant.isTaxIncludedInPrice ? totalAmount : totalAmount + (totalAmount * restaurant.taxRate / 100), // Calculate final amount including tax if not included in price
    paymentMethod,
    isPaid: false, // Default to false
    notes: notes
  })

  // Update the table to mark it as occupied and link the current order
  table.isOccupied = true;
  table.currentOrderId = order._id as any; // Type assertion to match the schema
  await table.save({ validateBeforeSave: false });

  res.status(201).json(new ApiResponse(
    201,
    order,
    "Order created successfully",
  ));
});

export const getOrderById = asyncHandler(async (req, res) => {
  if (!req.params.orderId || !req.params.restaurantSlug) {
    throw new ApiError(400, "Order ID and restaurant slug are required");
  }
const restaurantSlug = req.params.restaurantSlug;
const orderId = req.params.orderId;

  if(!isValidObjectId(orderId)){
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
        restaurantId: restaurant._id
      }
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
            }
        }
    ]
      }
    },
    {
      $unwind: "$restaurant"
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
            }
          }
        ]
      }
    },
    {
      $unwind: "$table"
    },
    { $unwind: "$foodItems" },
  // Lookup food item details
    {
    $lookup: {
      from: "fooditems",
      localField: "foodItems.foodItemId",
      foreignField: "_id",
      as: "foodItemDetails"
    }
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
              else: null
            }
          }, // Get the first image URL if available
          foodType: "$foodItemDetails.foodType",
          // check if the food item is a varinat
          isVariantOrder: {
            $cond: [
              { $ne: [ { $ifNull: ["$foodItems.variantName", ""] }, "" ] },
              true,
              false
            ]
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
                      cond: { $eq: ["$$variant.variantName", "$foodItems.variantName"] }
                    }
                  },
                  0
                ]
              },
              else: null
            }
          }
        }
      }
    }
  }
  ])

  if (!order || order.length === 0) {
    throw new ApiError(404, "Order not found");
  }

  res.status(200).json(new ApiResponse(
    200,
    order[0],
    "Order retrieved successfully",
  ));
});

export const getOrdersByRestaurant = asyncHandler(async (req, res) => {
  if (!req.params.restaurantSlug) {
    throw new ApiError(400, "Restaurant slug is required");
  }

  const restaurant = await Restaurant.findOne({ slug: req.params.restaurantSlug });

  if (!restaurant) {
    throw new ApiError(404, "Restaurant not found");
  }

  const orders = await Order.find({ restaurantId: restaurant._id })
    .populate("tableId", "qrSlug tableNumber")
    .populate("foodItems.foodItemId", "name price variants");

  res.status(200).json(new ApiResponse(
    200,
    orders,
    "Orders retrieved successfully",
  ));
});

export const getOrdersByTable = asyncHandler(async (req, res) => {
  if (!req.params.tableQrSlug) {
    throw new ApiError(400, "Table QR slug is required");
  }

  const table = await Table.findOne({ qrSlug: req.params.tableQrSlug });

  if (!table) {
    throw new ApiError(404, "Table not found");
  }

  const orders = await Order.find({ tableId: table._id })
    .populate("restaurantId", "name slug")
    .populate("foodItems.foodItemId", "name price variants");

  res.status(200).json(new ApiResponse(
    200,
    orders,
    "Orders retrieved successfully",
  ));
});