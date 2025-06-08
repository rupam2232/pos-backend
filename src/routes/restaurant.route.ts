import { Router } from "express";
import { verifyAuth } from "../middlewares/auth.middleware.js";
import {
  checkUniqueRestaurantSlug,
  createRestaurant,
  createRestaurantCategories,
  getRestaurantBySlug,
  removeRestaurantCategories,
  setRestaurantTax,
  toggleRestaurantOpenStatus,
  updateRestaurantDetails,
} from "../controllers/restaurant.controller.js";
import { rateLimit } from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

const createlimit = rateLimit({
  windowMs: 60 * 1000, // 1 minutes
  limit: 1, // Limit each IP to 1 requests per `window` (here, per 1 minutes).
  standardHeaders: "draft-8", //draft-8: `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  handler: () => {
    throw new ApiError(429, "Too many attempts, please try again in a minute.");
  },
});

const isProduction = process.env?.NODE_ENV === "production";

router.post(
  "/create",
  isProduction ? createlimit : (req, res, next) => next(),
  verifyAuth,
  createRestaurant
);

router
  .route("/:slug")
  .get(getRestaurantBySlug)
  .patch(verifyAuth, updateRestaurantDetails);
router.post(
  "/:slug/toggle-open-status",
  verifyAuth,
  toggleRestaurantOpenStatus
);
router
  .route("/:slug/categories")
  .post(verifyAuth, createRestaurantCategories)
  .patch(verifyAuth, removeRestaurantCategories);

router.post("/:slug/tax", verifyAuth, setRestaurantTax);

router.get("/:slug/isUniqueSlug", verifyAuth, checkUniqueRestaurantSlug);

export default router;
