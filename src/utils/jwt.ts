import jwt from "jsonwebtoken";

export interface accessTokenUser {
  _id: string;
  role: "admin" | "owner" | "staff";
  email: string;
  firstName?: string;
  [key: string]: any;
}

export const generateAccessToken = (user: accessTokenUser) => {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  const expiresIn = process.env.ACCESS_TOKEN_EXPIRY;

  return jwt.sign(user, secret as jwt.Secret, {
    expiresIn: `${Number(expiresIn)}d`,
  });
};

export const generateRefreshToken = (userId: accessTokenUser["_id"]) => {
  const secret = process.env.REFRESH_TOKEN_SECRET;
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRY;

  return jwt.sign({ _id: userId }, secret as jwt.Secret, {
    expiresIn: `${Number(expiresIn)}d`,
  });
};
