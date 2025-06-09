import { Router } from "express";
import {
  createTable,
  toggleOccupiedStatus,
  updateTable,
  getTableBySlug
} from "../controllers/table.controller.js";
import { verifyAuth } from "../middlewares/auth.middleware.js";
import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

const createLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minutes
  limit: 3, // Limit each IP to 3 requests per `window` (here, per 1 minutes).
  standardHeaders: "draft-8", //draft-8: `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  handler: () => {
    throw new ApiError(429, "Too many attempts, please try again in a minute.");
  },
});

const occupiedStatusUpdateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minutes
  limit: 5, // Limit each IP to 5 requests per `window` (here, per 1 minutes).
  standardHeaders: "draft-8", //draft-8: `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  handler: () => {
    throw new ApiError(429, "Too many attempts, please try again in a minute.");
  },
});

const isProduction = process.env?.NODE_ENV === "production";

router.post(
  "/create",
  isProduction ? createLimit : (req, res, next) => next(),
  verifyAuth,
  createTable
);

router.patch("/update/:tableId", isProduction ? occupiedStatusUpdateLimit : (req, res, next) => next(), verifyAuth, updateTable);

router.post(
  "/toggle-occupied-status/:tableId",
  verifyAuth,
  toggleOccupiedStatus
);

router.get("/:restaurantSlug/:qrSlug", verifyAuth, getTableBySlug)

export default router;
