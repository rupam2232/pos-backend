// Defines the Table schema and model for MongoDB using Mongoose
import { Schema, model, Document, Types } from "mongoose";

/**
 * TypeScript interface for a Table document.
 * Represents a table in a restaurant, including QR slug and occupancy.
 */
export interface Table extends Document {
  restaurantId: Types.ObjectId; // Reference to the Restaurant
  tableName: string; // Name/label of the table
  qrSlug: string; // Unique slug for QR code mapping
  isOccupied: boolean; // Whether the table is currently occupied
  currentOrderId?: Types.ObjectId; // Reference to the current Order (if any)
}

/**
 * Mongoose schema for the Table collection.
 */
const tableSchema: Schema<Table> = new Schema(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: [true, "Restaurant id is required"],
    },
    tableName: {
      type: String,
      required: [true, "Table name is required"],
    },
    qrSlug: {
      type: String,
      required: [true, "A unique slug is required"],
    },
    isOccupied: {
      type: Boolean,
      required: [true, "Is occupied field is required"],
    },
    currentOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound index to ensure all qr slugs are unique per restaurant.
 * Allows the qr slug to be used by different restaurants, but only once per restaurant.
 */
tableSchema.index({ restaurantId: 1, qrSlug: 1 }, { unique: true });

/**
 * Compound index to ensure all table names are unique per restaurant.
 * Allows the table name to be used by different restaurants, but only once per restaurant.
 */
tableSchema.index({ restaurantId: 1, tableName: 1 }, { unique: true });

/**
 * Mongoose model for the Table schema.
 */
export const Table = model<Table>("Table", tableSchema);
