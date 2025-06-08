import { User } from "../models/user.model.js";
import { SecurityEvent } from "../models/securityEvent.model.js";
import { DeviceSession } from "../models/deviceSession.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { NextFunction, Request, Response } from "express";
import { startSession } from "mongoose";
import requestIp from "request-ip";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js";
import { Subscription } from "../models/subscription.model.js";
import { SubscriptionHistory } from "../models/subscriptionHistory.model.js";
import sendEmail from "../utils/sendEmail.js";
// import { SIGNUP_EMAIL_TEMPLATE } from "../utils/emailTemplates.js";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await startSession();
  session.startTransaction();
  try {
    const { email, password } = req.body;

    if([email, password].some((value)=> value?.trim() === "")){
        throw new ApiError(400, "Email and Password both fields are required")
    }

    const isUserExists = await User.findOne({ email }).session(session);

    if (isUserExists) {
      throw new ApiError(400, "User already exists");
    }

    const user = await User.create([{ email, password }], { session });
    
    const refreshToken = generateRefreshToken(user[0]._id as string);
    const accessToken = generateAccessToken({
      _id: user[0]._id as string,
      email: user[0].email,
      role: user[0].role,
      avatar: "",
      firstName: "",
      totalRestaurants: 0
    });

    await DeviceSession.create(
      [
        {
          userId: user[0]._id,
          ipAddress: requestIp.getClientIp(req),
          userAgent: req.header("user-agent"),
          refreshToken,
        },
      ],
      { session }
    );

    await SecurityEvent.create(
      [
        {
          userId: user[0]._id,
          eventType: "signup",
          ipAddress: requestIp.getClientIp(req),
          userAgent: req.header("user-agent"),
        },
      ],
      { session }
    );

    const subscription = await Subscription.create(
      [
        {
          userId: user[0]._id,
          isTrial: true,
          trialExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isSubscriptionActive: true,
        },
      ],
      { session }
    );

    await SubscriptionHistory.create(
      [
        {
          userId: user[0]._id,
          amount: 0,
          isTrial: true,
          trialExpiresAt: subscription[0].trialExpiresAt,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // sendEmail(email, "signup-success", SIGNUP_EMAIL_TEMPLATE.replace("{name}", user[0].firstName ?? "User"))

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" as "none" : "Strict" as "strict"
    };
    res
    .status(201)
    .cookie("accessToken", accessToken, {...options, maxAge: Number(process.env.ACCESS_TOKEN_EXPIRY) * 24 * 60 * 60 * 1000})
    .cookie("refreshToken", refreshToken, {...options, maxAge: Number(process.env.REFRESH_TOKEN_EXPIRY) * 24 * 60 * 60 * 1000})
    .json(
      new ApiResponse(
        201,
        {
          _id: user[0]._id,
          email: user[0].email,
        },
        "Signup successful"
      )
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};
