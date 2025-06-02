import { User } from "../models/user.model.js";
import { SecurityEvent } from "../models/securityEvent.model.js";
import { DeviceSession } from "../models/deviceSession.model.js";
import { NextFunction, Request, Response } from "express";
import { startSession } from "mongoose";
import requestIp from "request-ip";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.js";
import { Subscription } from "../models/subscription.model.js";
import { SubscriptionHistory } from "../models/subscriptionHistory.model.js";
import sendEmail from "../utils/sendEmail.js";
import {
  NEW_LOGIN_DEVICE_TEMPLATE,
  SIGNUP_EMAIL_TEMPLATE,
} from "../utils/emailTemplates.js";
import { OAuth2Client } from "google-auth-library";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await startSession();
  session.startTransaction();
  try {
    if (!req?.body?.email || !req?.body?.password) {
      throw new ApiError(
        400,
        "Please provide a email and a password to continue"
      );
    }
    const { email, password } = req.body;

    if ([email, password].some((value) => value?.trim() === "")) {
      throw new ApiError(400, "Email and Password both fields are required");
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
      totalRestaurants: user[0].restaurantIds?.length || 0,
    });

    await DeviceSession.create(
      [
        {
          userId: user[0]._id,
          ipAddress: requestIp.getClientIp(req) || "Unknown IP",
          userAgent: req.header("user-agent") || "Unknown User Agent",
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
          ipAddress: requestIp.getClientIp(req) || "Unknown IP",
          userAgent: req.header("user-agent") || "Unknown User Agent",
          isEmailSent: true,
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

    sendEmail(
      email,
      "signup-success",
      SIGNUP_EMAIL_TEMPLATE.replace("{name}", user[0].firstName ?? "User")
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? ("None" as "none")
          : ("Strict" as "strict"),
    };
    res
      .status(201)
      .cookie("accessToken", accessToken, {
        ...options,
        maxAge: Number(process.env.ACCESS_TOKEN_EXPIRY) * 24 * 60 * 60 * 1000,
      })
      .cookie("refreshToken", refreshToken, {
        ...options,
        maxAge: Number(process.env.REFRESH_TOKEN_EXPIRY) * 24 * 60 * 60 * 1000,
      })
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

export const signin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await startSession();
  session.startTransaction();
  try {
    if (!req?.body?.email || !req?.body?.password) {
      throw new ApiError(
        400,
        "Please provide a email and a password to continue"
      );
    }
    const { email, password } = req.body;

    const user = await User.findOne({ email }).session(session);

    if (!user || !(await user.isPasswordCorrect(password))) {
      throw new ApiError(401, "Invalid credentials");
    }

    const refreshToken = generateRefreshToken(user._id as string);
    const accessToken = generateAccessToken({
      _id: user._id as string,
      email: user.email,
      role: user.role,
      avatar: user.avatar || "",
      firstName: user.firstName || "",
      totalRestaurants: user.restaurantIds?.length || 0,
    });

    const deviceSession = await DeviceSession.findOne({
      userId: user._id,
      ipAddress: requestIp.getClientIp(req),
      userAgent: req.header("user-agent"),
    }).session(session);

    if (deviceSession) {
      if (deviceSession.revoked) {
        throw new ApiError(
          401,
          "You don't have permission to access this account"
        );
      }
      deviceSession.refreshToken = refreshToken;
      deviceSession.lastActiveAt = new Date();
      await deviceSession.save();
    } else {
      await DeviceSession.create(
        [
          {
            userId: user._id,
            ipAddress: requestIp.getClientIp(req) || "Unknown IP",
            userAgent: req.header("user-agent") || "Unknown User Agent",
            refreshToken,
          },
        ],
        { session }
      );

      const { success } = await sendEmail(
        email,
        "new-login",
        NEW_LOGIN_DEVICE_TEMPLATE.replace("{name}", user.firstName ?? "User")
          .replace("{ipAddress}", requestIp.getClientIp(req) || "Unknown IP")
          .replace("{device}", req.header("user-agent") || "Unknown User Agent")
      );

      await SecurityEvent.create(
        [
          {
            userId: user._id,
            eventType: "new_login",
            ipAddress: requestIp.getClientIp(req) || "Unknown IP",
            userAgent: req.header("user-agent") || "Unknown User Agent",
            isEmailSent: success,
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? ("None" as "none")
          : ("Strict" as "strict"),
    };

    res
      .status(200)
      .cookie("accessToken", accessToken, {
        ...options,
        maxAge: Number(process.env.ACCESS_TOKEN_EXPIRY) * 24 * 60 * 60 * 1000,
      })
      .cookie("refreshToken", refreshToken, {
        ...options,
        maxAge: Number(process.env.REFRESH_TOKEN_EXPIRY) * 24 * 60 * 60 * 1000,
      })
      .json(
        new ApiResponse(
          200,
          {
            _id: user._id,
            email: user.email,
          },
          "Signin successful"
        )
      );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};

export const googleSignIn = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const session = await startSession();
  session.startTransaction();
  try {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    if (!req?.body?.idToken) {
      throw new ApiError(400, "Please provide a Google ID token to continue");
    }
    const { idToken } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new ApiError(400, "Invalid Google ID token");
    }
    const {
      sub: googleId,
      email,
      given_name,
      family_name,
      picture,
      name,
      email_verified,
    } = payload;

    if (!email_verified) {
      throw new ApiError(400, "Email not verified by Google");
    }

    const user = await User.findOne({ email }).session(session);

    if (user) {
      const refreshToken = generateRefreshToken(user._id as string);
      const accessToken = generateAccessToken({
        _id: user._id as string,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        firstName: user.firstName || "",
        totalRestaurants: user.restaurantIds?.length || 0,
      });

      const deviceSession = await DeviceSession.findOne({
        userId: user._id,
        ipAddress: requestIp.getClientIp(req),
        userAgent: req.header("user-agent"),
      }).session(session);

      if (deviceSession) {
        if (deviceSession.revoked) {
          throw new ApiError(
            401,
            "You don't have permission to access this account"
          );
        }
        deviceSession.refreshToken = refreshToken;
        deviceSession.lastActiveAt = new Date();
        await deviceSession.save();
      } else {
        await DeviceSession.create(
          [
            {
              userId: user._id,
              ipAddress: requestIp.getClientIp(req) || "Unknown IP",
              userAgent: req.header("user-agent") || "Unknown User Agent",
              refreshToken,
            },
          ],
          { session }
        );

        const { success } = await sendEmail(
          email,
          "new-login",
          NEW_LOGIN_DEVICE_TEMPLATE.replace("{name}", user.firstName ?? "User")
            .replace("{ipAddress}", requestIp.getClientIp(req) || "Unknown IP")
            .replace(
              "{device}",
              req.header("user-agent") || "Unknown User Agent"
            )
        );

        await SecurityEvent.create(
          [
            {
              userId: user._id,
              eventType: "new_login",
              ipAddress: requestIp.getClientIp(req) || "Unknown IP",
              userAgent: req.header("user-agent") || "Unknown User Agent",
              isEmailSent: success,
            },
          ],
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite:
          process.env.NODE_ENV === "production"
            ? ("None" as "none")
            : ("Strict" as "strict"),
      };

      res
        .status(200)
        .cookie("accessToken", accessToken, {
          ...options,
          maxAge: Number(process.env.ACCESS_TOKEN_EXPIRY) * 24 * 60 * 60 * 1000,
        })
        .cookie("refreshToken", refreshToken, {
          ...options,
          maxAge:
            Number(process.env.REFRESH_TOKEN_EXPIRY) * 24 * 60 * 60 * 1000,
        })
        .json(
          new ApiResponse(
            200,
            {
              _id: user._id,
              email: user.email,
            },
            "Google Signin successful"
          )
        );
    } else {
      const user = await User.create(
        [
          {
            email,
            firstName: given_name || name?.split(" ")[0],
            lastName: family_name || name?.split(" ")[1] || "",
            oauthProvider: "google",
            oauthId: googleId,
            avatar: picture || "",
          },
        ],
        { session }
      );

      const refreshToken = generateRefreshToken(user[0]._id as string);
      const accessToken = generateAccessToken({
        _id: user[0]._id as string,
        email: user[0].email,
        role: user[0].role,
        avatar: "",
        firstName: "",
        totalRestaurants: user[0].restaurantIds?.length || 0,
      });

      await DeviceSession.create(
        [
          {
            userId: user[0]._id,
            ipAddress: requestIp.getClientIp(req) || "Unknown IP",
            userAgent: req.header("user-agent") || "Unknown User Agent",
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
            ipAddress: requestIp.getClientIp(req) || "Unknown IP",
            userAgent: req.header("user-agent") || "Unknown User Agent",
            isEmailSent: true,
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

      sendEmail(
        email,
        "signup-success",
        SIGNUP_EMAIL_TEMPLATE.replace("{name}", user[0].firstName ?? "User")
      );

      const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite:
          process.env.NODE_ENV === "production"
            ? ("None" as "none")
            : ("Strict" as "strict"),
      };
      res
        .status(201)
        .cookie("accessToken", accessToken, {
          ...options,
          maxAge: Number(process.env.ACCESS_TOKEN_EXPIRY) * 24 * 60 * 60 * 1000,
        })
        .cookie("refreshToken", refreshToken, {
          ...options,
          maxAge:
            Number(process.env.REFRESH_TOKEN_EXPIRY) * 24 * 60 * 60 * 1000,
        })
        .json(
          new ApiResponse(
            201,
            {
              _id: user[0]._id,
              email: user[0].email,
            },
            "Google Signup successful"
          )
        );
    }
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    next(err);
  }
};
