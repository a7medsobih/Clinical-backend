import { Router } from "express";
import { verifyToken, allowRoles } from "../middleware/auth.js";
import {
  bookAppointment,
  myAppointments,
  cancelAppointment,
  getAlternatives,
  joinWaitingList,
  myWaitingList,
} from "../controllers/appointments.controller.js";

const router = Router();
const patientOnly = [verifyToken, allowRoles("patient")];

router.post("/appointments", patientOnly, bookAppointment);
router.get("/appointments/me", patientOnly, myAppointments);
router.patch("/appointments/:id/cancel", patientOnly, cancelAppointment);

// Public: other free doctors when a day is full
router.get("/doctors/:id/alternatives", getAlternatives);

router.post("/waiting-list", patientOnly, joinWaitingList);
router.get("/waiting-list/me", patientOnly, myWaitingList);

export default router;
