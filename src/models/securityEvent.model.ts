// Defines the SecurityEvent schema and model for MongoDB using Mongoose
import { Schema, model, Document, Types } from "mongoose";

/**
 * TypeScript interface for a SecurityEvent document.
 * Represents a security-related event for a user (e.g., login, password change).
 */
export interface SecurityEvent extends Document {
  userId: Types.ObjectId; // Reference to the User
  eventType: "new_login" | "password_change" | "signup"; // Type of security event
  ipAddress: string; // IP address where the event occurred
  userAgent: string; // User agent string of the device/browser
  isEmailSent: boolean; // True if email sent for the event
  createdAt: Date; // Timestamp when the document was first created (set automatically, never changes)
  updatedAt?: Date; // Timestamp when the document was last updated (set automatically, updates on modification)
}

/**
 * Mongoose schema for the SecurityEvent collection.
 */
const securityEventSchema: Schema<SecurityEvent> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Id of the user is required"],
      immutable: true,
    },
    eventType: {
      type: String,
      enum: ["new_login", "password_change", "signup"],
      required: [true, "Event type is required"],
      immutable: true,
    },
    ipAddress: {
      type: String,
      required: [true, "Ip address is required"],
      immutable: true,
    },
    isEmailSent: {
      type: Boolean,
      default: false,
      required: [true, "Is email sent is required"],
    },
    userAgent: {
      type: String,
      required: [true, "User agent is required"],
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
 * Mongoose model for the SecurityEvent schema.
 */
export const SecurityEvent = model<SecurityEvent>(
  "SecurityEvent",
  securityEventSchema
);
