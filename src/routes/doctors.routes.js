import { Router } from "express";
import { verifyToken, allowRoles } from "../middleware/auth.js";
import {
  searchDoctors,
  getDoctor,
  getDoctorSlots,
  updateClinic,
  updateSchedule,
} from "../controllers/doctors.controller.js";

const router = Router();
const doctorOnly = [verifyToken, allowRoles("doctor")];

// The doctor's own pages
router.put("/doctors/me/clinic", doctorOnly, updateClinic);
router.put("/doctors/me/schedule", doctorOnly, updateSchedule);

// Public: visitors can search and open profiles
router.get("/doctors", searchDoctors);
router.get("/doctors/:id", getDoctor);
router.get("/doctors/:id/slots", getDoctorSlots);

export default router;
