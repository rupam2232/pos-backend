// Defines the Order schema and model for MongoDB using Mongoose
import { Schema, model, Document, Types } from "mongoose";

/**
 * TypeScript interface for a FoodItem subdocument.
 * Represents a single food item (and optional variant) in an order.
 */
export interface FoodItem extends Document {
  foodItemId: Types.ObjectId; // Reference to the FoodItem
  variantName?: string; // Name of the variant (if any)
  quantity: number; // Quantity ordered
  price: number; // Price for this item/variant
}

/**
 * Mongoose schema for the FoodItem subdocument.
 */
const foodItemSchema: Schema<FoodItem> = new Schema({
  foodItemId: {
    type: Schema.Types.ObjectId,
    ref: "FoodItem",
    required: [true, "Food item's id is required"],
  },
  variantName: String,
  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
  },
});

/**
 * TypeScript interface for an Order document.
 * Represents a customer's order in the restaurant.
 */
export interface Order extends Document {
  restaurantId: Types.ObjectId; // Reference to the Restaurant
  tableId: Types.ObjectId; // Reference to the Table
  foodItems: FoodItem[]; // Array of ordered food items
  status: string; // Order status (pending, preparing, etc.)
  totalAmount: number; // The original total before discounts
  discountAmount?: number; // The discount applied (if any)
  finalAmount: number; // The amount the user actually paid
  paymentMethod: string; // Payment method (online, cash)
  isPaid: boolean; // Whether the order is paid
  notes?: string; // Optional notes for the order
  couponUsed?: string; // Optional coupon code used
  externalOrderId?: string; // Optional external/third-party order ID
  externalPlatform?: string; // Optional name of the external platform (e.g., Zomato, Swiggy)
  kitchenStaffId?: Types.ObjectId; // Optional reference to the kitchen staff handling the order
  customerName?: string; // Optional name of the customer for external orders
  customerPhone?: string; // Optional phone number of the customer for external orders
  deliveryAddress?: string; // Optional delivery address of the customer for external orders
}

/**
 * Mongoose schema for the Order collection.
 */
const orderSchema: Schema<Order> = new Schema(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: [true, "Restaurant id is required"],
    },
    tableId: {
      type: Schema.Types.ObjectId,
      ref: "Table",
      required: [true, "Table id is required"],
    },
    foodItems: {
      type: [foodItemSchema],
      required: [true, "Food items are required"],
      validate: {
        validator: function (arr: any[]) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: "Order must contain at least one food item",
      },
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: [
        "pending",
        "preparing",
        "ready",
        "served",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      required: [true, "Final amount is required"],
    },
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required"],
      enum: ["online", "cash"],
    },
    isPaid: {
      type: Boolean,
      required: [true, "Is paid is required"],
      default: false,
    },
    notes: String,
    couponUsed: String,
    externalOrderId: String,
    externalPlatform: String,
    kitchenStaffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    customerName: String,
    customerPhone: String,
    deliveryAddress: String,
  },
  {
    timestamps: true,
  }
);

/**
 * Mongoose model for the Order schema.
 */
export const Order = model<Order>("Order", orderSchema);
