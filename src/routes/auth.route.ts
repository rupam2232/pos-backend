import { Router } from "express";
import {
  google,
  signin,
  signout,
  signup,
} from "../controllers/auth.controller.js";
import { rateLimit } from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";
import { verifyAuth } from "../middlewares/auth.middleware.js";
import { verifyOtp } from "../middlewares/verifyOtp.middleare.js";

const router = Router();

// Rate limiting middleware to prevent abuse
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minutes
  limit: 3, // Limit each IP to 3 requests per `window` (here, per 1 minutes).
  standardHeaders: "draft-8", //draft-8: `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  handler: () => {
    throw new ApiError(429, "Too many attempts, please try again in a minute.");
  },
});

const isProduction = process.env?.NODE_ENV === "production";
// Apply rate limiting only in production
if (isProduction) router.use(limiter);

router.post("/signup", verifyOtp, signup);
router.post("/signin", signin);
router.post("/google", google);
router.post("/signout", verifyAuth, signout);

export default router;
