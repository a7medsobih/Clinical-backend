import { Router } from "express";
import { verifyToken, allowRoles } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  createDoctor,
  listDoctors,
  updateDoctor,
  deleteDoctor,
  listPatients,
  toggleBlock,
  listSpecialties,
  createSpecialty,
  deleteSpecialty,
  getStats,
} from "../controllers/admin.controller.js";

const router = Router();
const adminOnly = [verifyToken, allowRoles("admin")];

// Doctors (the syndicate card is sent in the "card" field)
router.post("/admin/doctors", adminOnly, upload.single("card"), createDoctor);
router.get("/admin/doctors", adminOnly, listDoctors);
router.put("/admin/doctors/:id", adminOnly, upload.single("card"), updateDoctor);
router.delete("/admin/doctors/:id", adminOnly, deleteDoctor);

// Patients
router.get("/admin/patients", adminOnly, listPatients);
router.patch("/admin/patients/:id/block", adminOnly, toggleBlock);

// Specialties (everyone can read them)
router.get("/specialties", listSpecialties);
router.post("/specialties", adminOnly, createSpecialty);
router.delete("/specialties/:id", adminOnly, deleteSpecialty);

// Statistics
router.get("/admin/stats", adminOnly, getStats);

export default router;
