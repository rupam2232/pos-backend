// Defines the Otp schema and model for MongoDB using Mongoose
import { Schema, model, Document } from "mongoose";
import bcrypt from "bcrypt";

// TypeScript interface for a Otp document.
export interface Otp extends Document {
  email: string;
  context: "signup" | "change-password";
  otp: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt?: Date;
  isOtpCorrect(otp: string): Promise<Boolean>;
}

/**
 * Mongoose schema for the Otp collection.
 */
const otpSchema: Schema<Otp> = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please use a valid email address",
      ],
    },
    context: {
      type: String,
      enum: ["signup", "change-password"],
      required: [true, "Context is required"],
    },
    otp: {
      type: String,
      required: [true, "Otp is required"],
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 10 * 60 * 1000),
      required: [true, "Expires at is required"],
      index: { expires: 0 }, // TTL Index: Deletes document after `expiresAt`
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save hook to hash the otp field before saving the otp document.
 */
otpSchema.pre("save", async function (next) {
  if (!this.isModified("otp")) return next();

  this.otp = await bcrypt.hash(this.otp, 10);
});

/**
 * Instance method to compare a plain password with the hashed password.
 */
otpSchema.methods.isOtpCorrect = async function (
  otp: Otp["otp"]
): Promise<Boolean> {
  if (!this.otp || !otp) {
    return false;
  } else {
    return await bcrypt.compare(otp, this.otp);
  }
};

/**
 * Mongoose model for the User schema.
 */
export const Otp = model<Otp>("Otp", otpSchema);
