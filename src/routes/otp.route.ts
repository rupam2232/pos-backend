import { Router } from "express";
import { sendOtp, verifyOtp } from "../controllers/otp.controller.js";
import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

const sendLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 1 day
  limit: 10, // Limit each IP to 10 requests per `window` (here, per 1 day).
  standardHeaders: "draft-8", //draft-8: `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  handler: () => {
    throw new ApiError(429, "Too many attempts, please try again tomorrow");
  },
});

const isProduction = process.env?.NODE_ENV === "production";

router.post("/send", isProduction ? sendLimit : (req, res, next)=> next(), sendOtp);
router.post("/verify", verifyOtp);

export default router;