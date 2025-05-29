// Defines the Subscription history schema and model for MongoDB using Mongoose
import { Schema, model, Document, Types } from "mongoose";

/**
 * TypeScript interface for a Subscription history document.
 * Represents a user's subscription history details, including plan, trial, and dates.
 */
export interface SubscriptionHistory extends Document {
  userId: Types.ObjectId; // Reference to the User
  plan?: "starter" | "medium" | "pro"; // Subscription plan name
  amount: Number; // Payment that user has made
  isTrial: boolean; // Whether the subscription is a trial
  trialExpiresAt?: Date; // When the trial expires
  subscriptionStartDate?: Date; // When the subscription starts
  subscriptionEndDate?: Date; // When the subscription ends
  transactionId?: string; // UPI/Card transaction reference (if any)
  paymentGateway?: string; // Payment gateway used (e.g., "Razorpay", "Stripe")
  createdAt: Date; // Timestamp when the document was first created (set automatically, never changes)
  updatedAt?: Date; // Timestamp when the document was last updated (set automatically, updates on modification)
}

/**
 * Mongoose schema for the Subscription history collection.
 */
const subscriptionHistorySchema: Schema<SubscriptionHistory> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Id of the user is required"],
      immutable: true,
    },
    plan: {
      type: String,
      enum: ["starter", "medium", "pro"],
      immutable: true,
    },
    amount: {
      type: Number,
      default: 0,
      required: [true, "Amount is required"],
      immutable: true,
    },
    isTrial: {
      type: Boolean,
      default: false,
      required: [true, "isTrial field is required"],
      immutable: true,
    },
    trialExpiresAt: {
      type: Date,
      immutable: true,
    },
    subscriptionStartDate: {
      type: Date,
      immutable: true,
    },
    subscriptionEndDate: {
      type: Date,
      immutable: true,
    },
    transactionId: {
      type: String,
      immutable: true,
    },
    paymentGateway: {
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
 * Mongoose model for the Subscription history schema.
 */
export const SubscriptionHistory = model<SubscriptionHistory>(
  "SubscriptionHistory",
  subscriptionHistorySchema
);
