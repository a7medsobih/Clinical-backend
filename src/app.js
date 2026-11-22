// The Express application. This module must not start a listener so it can be
// imported by a serverless function (Vercel) as well as the local server.
import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import doctorsRoutes from "./routes/doctors.routes.js";
import appointmentsRoutes from "./routes/appointments.routes.js";
import recordsRoutes from "./routes/records.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import { sendReminders } from "./controllers/notifications.controller.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5174" }));
app.use(express.json());

// Uploaded files (syndicate cards, diagnosis attachments)
app.use("/uploads", express.static("uploads"));

app.get("/api/health", (req, res) => res.json({ data: "Clinical API is running" }));

// Vercel invokes this endpoint daily; it replaces the in-process node-cron job.
// It fails closed so no one can trigger reminder e-mails from the public internet.
app.get("/api/cron/reminders", async (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get("authorization") !== `Bearer ${secret}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    await sendReminders();
    res.json({ data: { ok: true } });
  } catch (error) {
    next(error);
  }
});

// One router per module. "/doctors/me/..." routes come before "/doctors/:id".
app.use("/api", authRoutes);
app.use("/api", adminRoutes);
app.use("/api", notificationsRoutes);
app.use("/api", doctorsRoutes);
app.use("/api", appointmentsRoutes);
app.use("/api", recordsRoutes);

// Unknown route
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// One error handler for the whole app
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "The file is too big (max 10 MB)" : "The file could not be uploaded";
    return res.status(400).json({ message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "The request data is not valid" });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ message: "Not found" });
  }

  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : "Something went wrong on the server" });
});

export default app;
