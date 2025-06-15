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
    }
    foodItems.push({
      foodItemId: isFoodItemValid._id,
      variantName: foodItem.variantName || undefined, // Ensure variantName is included if provided
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
