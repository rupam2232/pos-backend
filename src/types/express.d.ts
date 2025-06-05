import type { User as UserType } from "../models/user.model.js";
// import type { Request } from "express";

// Extend Express Request interface to include 'user'
declare module "express-serve-static-core" {
  interface Request {
    user?: UserType;
  }
}
