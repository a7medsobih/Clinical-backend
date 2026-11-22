import { Router } from "express";
import { verifyToken, allowRoles } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { patientHistory, createDiagnosis, myRecords, createReview } from "../controllers/records.controller.js";

const router = Router();

router.get("/patients/:id/history", verifyToken, allowRoles("doctor"), patientHistory);
// Up to 5 files in the "files" field
router.post("/diagnoses", verifyToken, allowRoles("doctor"), upload.array("files", 5), createDiagnosis);
router.get("/records/me", verifyToken, allowRoles("patient"), myRecords);
router.post("/reviews", verifyToken, allowRoles("patient"), createReview);

export default router;
