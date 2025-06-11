import { Schema, model, Types, Document } from "mongoose";

export interface TemporaryMedia extends Document {
  userId: Types.ObjectId;
  mediaUrl: string;
  createdAt: Date;
}

const temporaryMediaSchema = new Schema<TemporaryMedia>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  mediaUrl: {
    type: String,
    validate: {
      validator: function (url: string) {
        return /^https?:\/\/.+\.(jpg|jpeg|png)$/.test(url);
      },
      message: "Media URL must be a valid image URL",
    },
    trim: true,
    unique: true,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: "30m", // Automatically delete documents after 30 minutes
  },
});

export const TemporaryMedia = model<TemporaryMedia>(
  "TemporaryMedia",
  temporaryMediaSchema
);
