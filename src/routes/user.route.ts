import { Router } from "express";
import { signup } from "../controllers/user.controller.js";

const router = Router()

router.get("/signup", signup)

export default router