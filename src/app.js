// src/app.js
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import corsMiddleware from "./config/cors.js";
import apiRateLimit from "./config/rate-limit.js";
import errorHandler from "./middlewares/error-handler.js";
import notFound from "./middlewares/not-found.js";
import authRouter from "./modules/auth/auth.routes.js";
import mediaRouter from "./modules/media/media.routes.js";
import { adminTeamRouter, publicTeamRouter } from "./modules/team/team.routes.js";

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(corsMiddleware);

// Parse request bodies and cookies
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// API routes
app.use("/api/v1", apiRateLimit);
app.use("/admin/v1", apiRateLimit);

// Health check
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "CMS CRUD API is running",
        timestamp: new Date().toISOString(),
    });
});

// Admin routes
app.use("/admin/v1/auth", authRouter);
app.use("/admin/media", apiRateLimit, mediaRouter);
app.use("/admin/team", apiRateLimit, adminTeamRouter);

// Public routes
app.use("/team", apiRateLimit, publicTeamRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
