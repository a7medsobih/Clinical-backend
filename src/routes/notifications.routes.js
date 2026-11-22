import { Router } from "express";
import { verifyToken, allowRoles } from "../middleware/auth.js";
import {
  listNotifications,
  markRead,
  markAllRead,
  doctorAppointments,
  updateStatus,
  doctorStats,
} from "../controllers/notifications.controller.js";

const router = Router();
const doctorOnly = [verifyToken, allowRoles("doctor")];

// Every logged-in user
router.get("/notifications", verifyToken, listNotifications);
router.patch("/notifications/read-all", verifyToken, markAllRead);
router.patch("/notifications/:id/read", verifyToken, markRead);

// Doctor dashboard
router.get("/doctors/me/appointments", doctorOnly, doctorAppointments);
router.patch("/appointments/:id/status", doctorOnly, updateStatus);
router.get("/doctors/me/stats", doctorOnly, doctorStats);

export default router;
