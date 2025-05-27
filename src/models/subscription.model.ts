// Defines the Subscription schema and model for MongoDB using Mongoose
import { Schema, model, Document, Types } from "mongoose";

/**
 * TypeScript interface for a Subscription document.
 * Represents a user's subscription details, including plan, trial, and dates.
 */
export interface Subscription extends Document{
    userId: Types.ObjectId;             // Reference to the User
    plan?: string;                      // Subscription plan name
    isTrial: boolean;                   // Whether the subscription is a trial
    trialExpiresAt?: Date;              // When the trial expires
    subscriptionStartDate?: Date;       // When the subscription starts
    subscriptionEndDate?: Date;         // When the subscription ends
    isSubscriptionActive?: boolean;     // Whether the subscription is currently active
}

/**
 * Mongoose schema for the Subscription collection.
 */
const subscriptionSchema: Schema<Subscription> = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Id of the user is required"]
    },
    plan: {
        type: String,
        enum: ["starter", "medium", "pro"],
    },
    isTrial: {
        type: Boolean,
        default: true,
        required: [true, "isTrial field is required"]
    },
    trialExpiresAt: Date,
    subscriptionStartDate: Date,
    subscriptionEndDate: Date,
    isSubscriptionActive: Boolean
},{
    timestamps: true,
})

/**
 * Mongoose model for the Subscription schema.
 */
export const Subscription = model<Subscription>("Subscription", subscriptionSchema)