// Defines the DeviceSession schema and model for MongoDB using Mongoose
import { Schema, model, Document, Types } from "mongoose";

/**
 * TypeScript interface for a DeviceSession document.
 * Represents a user's session on a specific device.
 */
export interface DeviceSession extends Document{
    userId: Types.ObjectId; // Reference to the User
    ipAddress: string;      // IP address of the device
    userAgent: string;      // User agent string of the device/browser
    refreshToken?: string;  // Refresh token for the session (optional)
    lastActiveAt: Date;     // Last activity timestamp
    revoked: boolean;       // Whether the session is revoked
}

/**
 * Mongoose schema for the DeviceSession collection.
 */
const deviceSessionSchema: Schema<DeviceSession> = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Id of the user is required"]
    },
    ipAddress: {
        type: String,
        required: [true, "Ip address is required"]
    },
    userAgent: {
        type: String,
        required: [true, "User agent is required"]
    },
    refreshToken: String,
    lastActiveAt: {
        type: Date,
        default: Date.now,
        required: [true, "Last active is required"]
    },
    revoked: {
        type: Boolean,
        default: false,
        required: [true, "Revoked is required"]
    }
},{
    timestamps: true
})

/**
 * Mongoose model for the DeviceSession schema.
 */
export const DeviceSession = model<DeviceSession>("DeviceSession", deviceSessionSchema)