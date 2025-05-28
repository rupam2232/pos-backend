// Defines the Payment schema and model for MongoDB using Mongoose
import { Schema, model, Document, Types } from "mongoose";

/**
 * TypeScript interface for a Payment document.
 * Represents a payment transaction for an order, including method, status, and financial breakdown.
 */
export interface Payment extends Document {
  orderId: Types.ObjectId;         // Reference to the related Order
  method: "cash" | "upi" | "card"; // Type of payment (cash, UPI, or card)
  status: "pending" | "paid" | "failed"; // Payment status
  subtotal: number;                // Amount for only food items (before tax, discount, tip)
  totalAmount: number;             // Final amount to be paid (after discount, tax, tip, if any)
  discountAmount?: number;         // Amount deducted due to coupon (if any)
  couponUsed?: string;             // Coupon code used (optional)
  taxAmount?: number;              // Total tax applied (if any)
  tipAmount?: number;              // Optional tip given by customer
  kitchenStaffId?: Types.ObjectId; // Optional reference to the kitchen staff handling the cash payment
  transactionId?: string;          // UPI/Card transaction reference (if any)
  paymentGateway?: string;         // Payment gateway used (e.g., "Razorpay", "Stripe")
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
    },
    method: {
      type: String,
      enum: ["cash", "upi", "card"],
      required: [true, "Payment method is required"],
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      required: [true, "Payment status is required"],
    },
    subtotal: {
      type: Number,
      required: [true, "Sub total is required"],
    },
    totalAmount: {
        type: Number,
        required: [true, "Total amount is required"]
    },
    discountAmount: Number,
    couponUsed: String,
    taxAmount: Number,
    tipAmount: Number,
    kitchenStaffId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    transactionId: String,
    paymentGateway: String,
  },
  {
    timestamps: true,
  }
);

/**
 * Mongoose model for the Payment schema.
 */
export const Payment = model<Payment>("Payment", paymentSchema);
