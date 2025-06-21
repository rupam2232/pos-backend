import { Router } from "express";
import {
  createTable,
  toggleOccupiedStatus,
  updateTable,
  getTableBySlug,
  getAllTablesOfRestaurant,
  deleteTable,
} from "../controllers/table.controller.js";
import { verifyAuth } from "../middlewares/auth.middleware.js";
import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";
import { verifyOptionalAuth } from "../middlewares/optionalAuth.middleware.js";
import { isSubscriptionActive } from "../middlewares/subscriptionCheck.middleware.js";

const router = Router();

const createLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minutes
  limit: 3, // Limit each IP to 3 requests per `window` (here, per 1 minutes).
  standardHeaders: "draft-8", //draft-8: `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  handler: () => {
    throw new ApiError(429, "Too many attempts, please try again in a minute");
  },
});

const occupiedStatusUpdateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minutes
  limit: 5, // Limit each IP to 5 requests per `window` (here, per 1 minutes).
  standardHeaders: "draft-8", //draft-8: `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  handler: () => {
    throw new ApiError(429, "Too many attempts, please try again in a minute");
  },
});

const isProduction = process.env?.NODE_ENV === "production";

router
  .route("/:restaurantSlug")
  .get(verifyAuth, getAllTablesOfRestaurant)
  .post(
    isProduction ? createLimit : (req, res, next) => next(),
    verifyAuth,
    isSubscriptionActive,
    createTable
  );

router.post(
  "/:restaurantSlug/:qrSlug/toggle-occupied",
  isProduction ? occupiedStatusUpdateLimit : (req, res, next) => next(),
  verifyAuth,
  toggleOccupiedStatus
);

router
  .route("/:restaurantSlug/:qrSlug")
  .get(verifyOptionalAuth, getTableBySlug)
  .patch(verifyAuth, updateTable)
  .delete(verifyAuth, deleteTable);

export default router;