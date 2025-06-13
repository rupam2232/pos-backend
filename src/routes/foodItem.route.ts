import { Router } from "express";
import {
  createFoodItem,
  deleteFoodItem,
  getAllFoodItemsOfRestaurant,
  getFoodItemById,
  toggleFoodItemAvailability,
  updateFoodItem,
} from "../controllers/foodItem.controller.js";
import { verifyAuth } from "../middlewares/auth.middleware.js";
import { isSubscriptionActive } from "../middlewares/subscriptionCheck.middleware.js";
import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

const limit = rateLimit({
  windowMs: 60 * 1000, // 1 minutes
  limit: 3, // Limit each IP to 3 requests per `window` (here, per 1 minutes).
  standardHeaders: "draft-8", //draft-8: `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  handler: () => {
    throw new ApiError(429, "Too many attempts, please try again in a minute.");
  },
});

const isProduction = process.env?.NODE_ENV === "production";

router
  .route("/:restaurantSlug")
  .post(
    isProduction ? limit : (req, res, next) => next(),
    verifyAuth,
    isSubscriptionActive,
    createFoodItem
  )
  .get(getAllFoodItemsOfRestaurant);

router
  .route("/:restaurantSlug/:foodItemId")
  .get(getFoodItemById)
  .patch(
    isProduction ? limit : (req, res, next) => next(),
    verifyAuth,
    updateFoodItem
  )
  .delete(
    isProduction ? limit : (req, res, next) => next(),
    verifyAuth,
    deleteFoodItem
  );

router.post(
  "/:restaurantSlug/:foodItemId/toggle-availability",
  isProduction ? limit : (req, res, next) => next(),
  verifyAuth,
  toggleFoodItemAvailability
);

export default router;
