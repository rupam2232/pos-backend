import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import type { accessTokenUser } from "../utils/jwt.js";
import type { User as UserType } from "../models/user.model.js";
import { DeviceSession } from "../models/deviceSession.model.js";
import requestIp from "request-ip";
import { ApiResponse } from "../utils/ApiResponse.js";

export const verifyOptionalAuth = asyncHandler(async (req, res, next) => {
  const accessToken =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");
  const refreshToken = req.cookies?.refreshToken;

  let decoded = null;
  if (accessToken) {
    decoded = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET as string
    );
    if (typeof decoded !== "object" || decoded === null) {
      next(); // If the token is invalid, just continue without attaching user
    } else {
      const decodedToken = decoded as accessTokenUser;

      const user: UserType = await User.findById(decodedToken._id).select(
        "-password"
      );

      if (!user) {
        next(); // If user not found, continue without attaching user
      } else {
        const deviceSession = await DeviceSession.findOne({
          userId: user._id,
          ipAddress: requestIp.getClientIp(req),
          userAgent: req.header("user-agent"),
        });

        if (
          !deviceSession ||
          deviceSession.refreshToken !== refreshToken ||
          deviceSession.revoked
        ) {
          // If the device session is not found, or the refresh token does not match, or the session is revoked
          throw res
            .status(401)
            .clearCookie("accessToken")
            .clearCookie("refreshToken")
            .json(new ApiResponse(401, null, "Unauthorized request", false));
        }
        // Update the last active time of the device session
        deviceSession.lastActiveAt = new Date();
        deviceSession.save();

        // Attach user to the request object
        req.user = user;
        next();
      }
    }
  } else {
    // If no access token, just continue without attaching user
    next();
  }
});
