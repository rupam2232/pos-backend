import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

interface accessTokeUser {
  _id: string;
  role: "admin" | "owner" | "staff";
  email: string;
  avatar?: string;
  oauthId?: string;
  firstName?: string;
}

export const generateAccessToken = (user: accessTokeUser) => {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  const expiresIn = process.env.ACCESS_TOKEN_EXPIRY;

  return jwt.sign(user, secret as jwt.Secret, {
    expiresIn: `${Number(expiresIn)}d`,
  });
};

export const generateRefreshToken = (userId: accessTokeUser["_id"]) => {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    const expiresIn = process.env.REFRESH_TOKEN_EXPIRY;

    return jwt.sign({_id: userId}, secret as jwt.Secret, {
    expiresIn: `${Number(expiresIn)}d`,
  });
}
