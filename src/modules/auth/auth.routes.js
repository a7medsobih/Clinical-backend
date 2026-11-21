import { Router } from "express";
import rateLimit from "express-rate-limit";

import requireAuth from "../../middlewares/require-auth.js";
import { changePassword, login, logout, me } from "./auth.controller.js";

const router = Router();

// The in-memory store is appropriate for local development. Use a shared store
// when running multiple production server instances.
const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { success: false, message: "Too many login attempts. Please try again later." },
});

router.post("/login", loginRateLimit, login);
router.use(requireAuth);
router.post("/logout", logout);
router.get("/me", me);
router.patch("/change-password", changePassword);

export default router;
