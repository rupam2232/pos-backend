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
  seatCount: number; // Number of seats at the table
  isOccupied: boolean; // Whether the table is currently occupied
  currentOrderId?: Types.ObjectId; // Reference to the current Order (if any)
  createdAt: Date; // Timestamp when the document was first created (set automatically, never changes)
  updatedAt?: Date; // Timestamp when the document was last updated (set automatically, updates on modification)
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
      immutable: true
    },
    tableName: {
      type: String,
      required: [true, "Table name is required"],
      trim: true,
      minlength: [1, "Table name must be at least 1 character"],
      maxlength: [50, "Table name cannot exceed 50 characters"],
    },
    qrSlug: {
      type: String,
      required: [true, "A unique slug is required"],
    },
    seatCount: {
      type: Number,
      required: [true, "Seat count is required"],
      default: 1,
      min: [1, "Seat count must be at least 1"],
      max: [100, "Seat count cannot exceed 100"],
    },
    isOccupied: {
      type: Boolean,
      required: [true, "Is occupied field is required"],
      default: false,
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
