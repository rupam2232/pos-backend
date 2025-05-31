// Defines the Coupon schema and model for MongoDB using Mongoose
import { Schema, model, Document, Types } from "mongoose";

/**
 * TypeScript interface for a Coupon document.
 * Represents a discount coupon for a restaurant, including code, discount, usage limits, and validity.
 */
export interface Coupon extends Document {
  restaurantId: Types.ObjectId; // Reference to the Restaurant this coupon belongs to
  code: string; // Unique coupon code (1-10 characters, unique per restaurant)
  discountPercent: number; // Discount percentage (1-100)
  isActive: boolean; // Whether the coupon is currently active
  minOrderAmount: number; // Minimum order amount required to use the coupon
  maxUses?: number; // Maximum times this coupon can be used (optional)
  usageCount: number; // Number of times this coupon has been used
  validFrom: Date; // Start date/time for coupon validity
  validUntil?: Date; // End date/time for coupon validity (optional)
  createdAt: Date; // Timestamp when the document was first created (set automatically, never changes)
  updatedAt?: Date; // Timestamp when the document was last updated (set automatically, updates on modification)
}

/**
 * Mongoose schema for the Coupon collection.
 * Stores all coupon-related information for a restaurant.
 */
const couponSchema: Schema<Coupon> = new Schema(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: [true, "Restaurant id is required"],
      immutable: true,
    },
    code: {
      type: String,
      required: [true, "Code is required"],
      validate: {
        validator: function (str: string) {
          return str.length > 0 && str.length < 11;
        },
        message: "Code must be 1-10 characters",
      },
      immutable: true,
    },
    discountPercent: {
      type: Number,
      required: [true, "Discount percent is required"],
      min: 1,
      max: 100,
      immutable: true
    },
    isActive: {
      type: Boolean,
      default: true,
      required: [true, "Is active is required"],
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      required: [true, "Min order amount is required"],
    },
    maxUses: Number,
    usageCount: {
      type: Number,
      default: 0,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: Date,
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
 * Compound index to ensure coupon codes are unique per restaurant.
 * Allows the same code to be used by different restaurants, but only once per restaurant.
 */
couponSchema.index({ restaurantId: 1, code: 1 }, { unique: true });

/**
 * Mongoose model for the Coupon schema.
 */
export const Coupon = model<Coupon>("Coupon", couponSchema);
