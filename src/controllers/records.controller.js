// Module 4 – Records: patient history, diagnoses with files, my records, reviews
import prisma from "../prisma.js";
import { notify } from "../utils/notify.js";
import { originalName } from "../middleware/upload.js";

// What we load for each visit in a medical history
const visitInclude = {
  doctor: { include: { user: { select: { name: true } }, specialty: true } },
  diagnosis: { include: { attachments: true } },
  review: true,
};

// GET /api/patients/:id/history – a doctor reads the history of HIS patient only
export async function patientHistory(req, res) {
  const patientId = Number(req.params.id);

  // The history rule: the patient must have an appointment with this doctor
  const hasAppointment = await prisma.appointment.findFirst({
    where: { patientId, doctorId: req.user.id },
  });
  if (!hasAppointment) {
    return res.status(403).json({ message: "You can only see the history of your own patients" });
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: patientId },
    include: { user: { select: { name: true, phone: true, email: true } } },
  });

  const visits = await prisma.appointment.findMany({
    where: { patientId, status: "completed" },
    include: visitInclude,
    orderBy: [{ date: "desc" }, { time: "desc" }],
  });

  res.json({ data: { patient, visits } });
}

// POST /api/diagnoses – the doctor writes the diagnosis (form-data, files are optional)
export async function createDiagnosis(req, res) {
  const appointmentId = Number(req.body.appointmentId);
  const { description, prescription, notes } = req.body;

  if (!appointmentId || !description) {
    return res.status(400).json({ message: "The diagnosis description is required" });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { diagnosis: true, doctor: { include: { user: true } } },
  });
  if (!appointment || appointment.doctorId !== req.user.id) {
    return res.status(404).json({ message: "Appointment not found" });
  }
  if (appointment.status === "cancelled") {
    return res.status(400).json({ message: "This appointment was cancelled" });
  }
  if (appointment.diagnosis) {
    return res.status(400).json({ message: "This appointment already has a diagnosis" });
  }

  const files = req.files || [];
  const diagnosis = await prisma.diagnosis.create({
    data: {
      appointmentId,
      description,
      prescription,
      notes,
      attachments: {
        create: files.map((file) => ({
          fileName: originalName(file),
          filePath: `/uploads/${file.filename}`,
          fileType: file.mimetype,
        })),
      },
    },
    include: { attachments: true },
  });

  // The visit is finished now
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "completed" } });
  await notify(
    appointment.patientId,
    "Your diagnosis is ready",
    `Dr. ${appointment.doctor.user.name} added the diagnosis of your visit. You can also rate the visit.`,
    "/my-records"
  );

  res.status(201).json({ data: diagnosis });
}

// GET /api/records/me – the patient's own medical record (completed visits)
export async function myRecords(req, res) {
  const visits = await prisma.appointment.findMany({
    where: { patientId: req.user.id, status: "completed" },
    include: visitInclude,
    orderBy: [{ date: "desc" }, { time: "desc" }],
  });

  res.json({ data: visits });
}

// POST /api/reviews – the patient rates his own completed appointment, once
export async function createReview(req, res) {
  const appointmentId = Number(req.body.appointmentId);
  const rating = Number(req.body.rating);
  const { comment } = req.body;

  if (!appointmentId || !(rating >= 1 && rating <= 5)) {
    return res.status(400).json({ message: "Please choose a rating from 1 to 5 stars" });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { review: true },
  });
  if (!appointment || appointment.patientId !== req.user.id) {
    return res.status(404).json({ message: "Appointment not found" });
  }
  if (appointment.status !== "completed") {
    return res.status(400).json({ message: "You can rate a visit only after it is completed" });
  }
  if (appointment.review) {
    return res.status(400).json({ message: "You already rated this visit" });
  }

  const review = await prisma.review.create({ data: { appointmentId, rating, comment } });
  await notify(appointment.doctorId, "New review", `${req.user.name} rated the visit ${rating}/5.`, "/doctor/reports");

  res.status(201).json({ data: review });
}
