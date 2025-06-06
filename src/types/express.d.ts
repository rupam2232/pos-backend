import type { User as UserType } from "../models/user.model.js";
// Not working


// Extend Express Request interface to include 'user'
declare module "express-serve-static-core" {
  interface Request {
    user?: UserType;
  }
  interface Response {
    user?: UserType;
  }
}
