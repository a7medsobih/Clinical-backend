import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { register, login, getMe, updateMe } from "../controllers/auth.controller.js";

const router = Router();

router.post("/auth/register", register);
router.post("/auth/login", login);
router.get("/auth/me", verifyToken, getMe);
router.put("/auth/me", verifyToken, updateMe);

export default router;
