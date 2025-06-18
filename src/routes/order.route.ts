import { Router } from "express";
import { createOrder, getOrderById, getOrdersByRestaurant, getOrderByTable, updateOrderStatus, updateOrder } from "../controllers/order.controller.js";
import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";
import { verifyAuth } from "../middlewares/auth.middleware.js";
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

const isProduction = process.env?.NODE_ENV === "production";

router.post(
  "/:restaurantSlug/:tableQrSlug",
  isProduction ? createLimit : (req, res, next) => next(),
  createOrder
);

router.route("/:restaurantSlug/:orderId")
  .get(getOrderById) // Get order by ID
  .patch(verifyAuth, updateOrder); // Update order

router.get("/:restaurantSlug", verifyAuth, getOrdersByRestaurant)

router.get("/:restaurantSlug/table/:tableQrSlug", verifyAuth, getOrderByTable);

router.patch("/:restaurantSlug/:orderId/status", verifyAuth, updateOrderStatus);

export default router;
