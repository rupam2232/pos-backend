// Defines the FoodItem schema and model for MongoDB using Mongoose
import { Schema, model, Document, Types } from "mongoose";

/**
 * TypeScript interface for a FoodVariant subdocument.
 * Represents a specific variant of a food item (e.g., size, flavor).
 */
export interface FoodVariant extends Document {
  variantName: string; // Name/label of the variant (e.g., "Large", "Spicy")
  price: number; // Price for this variant
  description?: string; // Description for this variant
  discountedPrice?: number; // Optional final price after discount for this variant
  isAvailable: boolean; // Whether this variant is currently available
}

/**
 * Mongoose schema for the FoodVariant subdocument.
 */
const foodVariantSchema: Schema<FoodVariant> = new Schema({
  variantName: {
    type: String,
    required: [true, "Variant's name is required"],
  },
  price: {
    type: Number,
    required: [true, "Price is required"],
  },
  description: String,
  discountedPrice: Number,
  isAvailable: {
    type: Boolean,
    default: true,
    required: [true, "Is available is required"],
  },
});

/**
 * TypeScript interface for a FoodItem document.
 * Represents a food item in a restaurant's menu, which may have variants.
 */
export interface FoodItem extends Document {
  restaurantId: Types.ObjectId; // Reference to the Restaurant
  foodName: string; // Name of the food item
  price: number; // Base price of the food item
  discountedPrice?: number; // Optional final price after discount
  hasVariants: boolean; // Whether this item has variants
  variants: FoodVariant[]; // Array of variants (if any)
  imageUrls?: string[]; // Optional array of image URLs
  category?: string; // Optional category (e.g., "Indian", "Snacks")
  foodType: "veg" | "non-veg"; // Type of the food (veg or non-veg)
  description?: string; // Optional description of the food item
  tags?: string[]; // Optional tags for search/filtering (e.g., "Spicy", "Veg")
  isAvailable: boolean; // Whether the item is currently available
  createdAt: Date; // Timestamp when the document was first created (set automatically, never changes)
  updatedAt?: Date; // Timestamp when the document was last updated (set automatically, updates on modification)
}

/**
 * Mongoose schema for the FoodItem collection.
 */
const foodItemSchema: Schema<FoodItem> = new Schema(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: [true, "Restaurant id is required"],
      immutable: true,
    },
    foodName: {
      type: String,
      required: [true, "Food name is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price of the food is required"],
    },
    discountedPrice: Number,
    hasVariants: {
      type: Boolean,
      default: false,
      required: [true, "Has variants is required"],
    },
    variants: {
      type: [foodVariantSchema],
      default: [],
      validate: {
        validator: function (arr: any[]) {
          return arr.length <= 6;
        },
        message: "You can only create maximum 6 food variants",
      },
    },
    imageUrls: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr: string[]) {
          return arr.length <= 5;
        },
        message: "You can only upload a maximum of 5 images for a food item",
      },
    },
    category: String,
    foodType: {
      type: String,
      enum: ["veg", "non-veg"],
      required: [true, "Food type is required"],
    },
    description: {
      type: String,
      trim: true
    },
    tags: {
      type: [String],
      default: [],
    },
    isAvailable: {
      type: Boolean,
      default: true,
      required: [true, "Is available is required"],
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound index to ensure all food names are unique per restaurant.
 * Allows the food name to be used by different restaurants, but only once per restaurant.
 */
foodItemSchema.index({ restaurantId: 1, foodName: 1 }, { unique: true });

/**
 * Mongoose model for the FoodItem schema.
 */
export const FoodItem = model<FoodItem>("FoodItem", foodItemSchema);
