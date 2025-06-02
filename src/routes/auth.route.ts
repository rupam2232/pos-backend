import { Router } from "express";
import { googleSignIn, signin, signup } from "../controllers/auth.controller.js";

const router = Router()

router.post("/signup", signup)
router.post("/signin", signin)
router.post("/google", googleSignIn)

export default router