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
  status:
    | "pending"
    | "preparing"
    | "ready"
    | "served"
    | "completed"
    | "cancelled"; // Order status (pending, preparing, etc.)
  paymentAttempts?: Types.ObjectId[]; // Optional array of payment attempt IDs
  isPaid: boolean; // Whether the order is paid
  notes?: string; // Optional notes for the order
  couponUsed?: Types.ObjectId; // Optional reference to the coupon code used
  externalOrderId?: string; // Optional external/third-party order ID
  externalPlatform?: string; // Optional name of the external platform (e.g., Zomato, Swiggy)
  kitchenStaffId?: Types.ObjectId; // Optional reference to the kitchen staff handling the order
  customerName?: string; // Optional name of the customer for external orders
  customerPhone?: string; // Optional phone number of the customer for external orders
  deliveryAddress?: string; // Optional delivery address of the customer for external orders
  createdAt: Date; // Timestamp when the document was first created (set automatically, never changes)
  updatedAt?: Date; // Timestamp when the document was last updated (set automatically, updates on modification)
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
      immutable: true,
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
      immutable(doc) {
        return doc.status === "completed" || doc.status === "cancelled";
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
      immutable(doc) {
        return doc.status === "completed" || doc.status === "cancelled";
      },
    },
    paymentAttempts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Payment",
        immutable(doc) {
          return doc.status === "completed" || doc.status === "cancelled";
        },
      },
    ],
    isPaid: {
      type: Boolean,
      required: [true, "Is paid is required"],
      default: false,
      immutable(doc) {
        return doc.status === "completed" || doc.status === "cancelled";
      },
    },
    notes: String,
    couponUsed: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      immutable(doc) {
        return doc.status === "completed" || doc.status === "cancelled";
      },
    },
    externalOrderId: {
      type: String,
      immutable: true,
    },
    externalPlatform: {
      type: String,
      immutable: true,
    },
    kitchenStaffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      immutable(doc) {
        return (
          doc.status === "preparing" ||
          doc.status === "ready" ||
          doc.status === "served" ||
          doc.status === "completed" ||
          doc.status === "cancelled"
        );
      },
    },
    customerName: {
      type: String,
      immutable: true,
    },
    customerPhone: {
      type: String,
      immutable: true,
    },
    deliveryAddress: {
      type: String,
      immutable: true,
    },
    createdAt: {
      type: Date,
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Mongoose model for the Order schema.
 */
export const Order = model<Order>("Order", orderSchema);
