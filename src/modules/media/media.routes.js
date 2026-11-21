import { Router } from "express";

import requireAuth from "../../middlewares/require-auth.js";
import { deleteMedia, uploadMedia } from "./media.controller.js";
import { uploadMedia as uploadMiddleware } from "./media.upload.js";

const router = Router();

router.use(requireAuth);
router.post("/upload", uploadMiddleware, uploadMedia);
router.delete("/:id", deleteMedia);

export default router;
