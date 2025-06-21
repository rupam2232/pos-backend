// Defines the Payment schema and model for MongoDB using Mongoose
import { Schema, model, Document, Types } from "mongoose";

/**
 * TypeScript interface for a Payment document.
 * Represents a payment transaction for an order, including method, status, and financial breakdown.
 */
export interface Payment extends Document {
  orderId: Types.ObjectId; // Reference to the related Order
  method: "cash" | "online"; // Type of payment (cash, or online)
  status: "pending" | "paid" | "failed"; // Payment status
  subtotal: number; // Amount for only food items (before tax, discount, tip)
  totalAmount: number; // Final amount to be paid (after discount, tax, tip, if any)
  discountAmount?: number; // Amount deducted due to discount (if any)
  couponUsed?: Types.ObjectId; // Reference to the coupon code used (optional)
  taxAmount?: number; // Total tax applied (if any)
  tipAmount?: number; // Optional tip given by customer
  kitchenStaffId?: Types.ObjectId; // Optional reference to the kitchen staff handling the cash payment
  paymentGateway?: string; // Payment gateway used (e.g., "Razorpay", "Stripe")
  gatewayOrderId?: string; // Optional order ID from the payment gateway (if applicable)
  gatewayPaymentId?: string; // Optional payment ID from the payment gateway (if applicable)
  gatewaySignature?: string; // Optional signature from the payment gateway (if applicable)
  transactionId?: string; // UPI/Card transaction reference (if any)
  createdAt: Date; // Timestamp when the document was first created (set automatically, never changes)
  updatedAt?: Date; // Timestamp when the document was last updated (set automatically, updates on modification)
}

/**
 * Mongoose schema for the Payment collection.
 * Stores all payment-related information for an order.
 */
const paymentSchema: Schema<Payment> = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order id is required"],
      immutable: true,
    },
    method: {
      type: String,
      enum: ["cash", "online"],
      required: [true, "Payment method is required"],
      immutable(doc) {
        return doc.status === "paid" || doc.status === "failed";
      },
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      required: [true, "Payment status is required"],
      immutable(doc) {
        return doc.status === "paid" || doc.status === "failed";
      },
    },
    subtotal: {
      type: Number,
      required: [true, "Sub total is required"],
      immutable: true,
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      immutable: true,
    },
    discountAmount: {
      type: Number,
      immutable(doc) {
        return doc.status === "paid" || doc.status === "failed";
      },
    },
    couponUsed: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      immutable(doc) {
        return doc.status === "paid" || doc.status === "failed";
      },
    },
    taxAmount: {
      type: Number,
      immutable(doc) {
        return doc.status === "paid" || doc.status === "failed";
      },
    },
    tipAmount: {
      type: Number,
      default: 0,
      immutable(doc) {
        return doc.status === "paid" || doc.status === "failed";
      },
    },
    kitchenStaffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      immutable(doc) {
        return !!doc.kitchenStaffId;
      },
    },
    paymentGateway: {
      type: String,
      immutable(doc) {
        return doc.method === "paid" || doc.method === "failed";
      },
    },
    gatewayOrderId: {
      type: String,
      immutable(doc) {
        return doc.method === "paid" || doc.method === "failed";
      },
    },
    gatewayPaymentId: {
      type: String,
      immutable(doc) {
        return doc.method === "paid" || doc.method === "failed";
      },
    },
    gatewaySignature: {
      type: String,
      immutable(doc) {
        return doc.method === "paid" || doc.method === "failed";
      },
    },
    transactionId: {
      type: String,
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
 * Mongoose model for the Payment schema.
 */
export const Payment = model<Payment>("Payment", paymentSchema);
