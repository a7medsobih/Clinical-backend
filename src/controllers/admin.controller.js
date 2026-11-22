// Module 1 – Admin: doctors, patients, specialties and statistics
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { sendEmail } from "../utils/email.js";
import { today } from "../utils/slots.js";

// A random 8-character password, e.g. "k7Qm2xPa"
function randomPassword() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += letters[crypto.randomInt(letters.length)];
  }
  return password;
}

// Reads the number fields of a doctor form (form-data sends everything as text)
function doctorNumbers(body) {
  return {
    specialtyId: Number(body.specialtyId),
    fee: Number(body.fee) || 0,
    dailyLimit: Number(body.dailyLimit) || 20,
  };
}

// ---------- Doctors ----------

// POST /api/admin/doctors – create a doctor account after checking his syndicate card
export async function createDoctor(req, res) {
  const { name, email, phone, bio } = req.body;
  const { specialtyId, fee, dailyLimit } = doctorNumbers(req.body);

  if (!req.file) {
    return res.status(400).json({ message: "Please upload a copy of the syndicate card" });
  }
  if (!name || !email || !specialtyId) {
    return res.status(400).json({ message: "Name, e-mail and specialty are required" });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return res.status(400).json({ message: "This e-mail is already used by another account" });
  }

  const password = randomPassword();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      role: "doctor",
      password: await bcrypt.hash(password, 10),
      doctor: {
        create: {
          specialtyId,
          bio,
          fee,
          dailyLimit,
          syndicateCard: `/uploads/${req.file.filename}`,
          addedById: req.user.id,
        },
      },
    },
    omit: { password: true },
    include: { doctor: { include: { specialty: true } } },
  });

  await sendEmail(
    email,
    "Your Clinical doctor account",
    `Hello Dr. ${name},\n\nYour account on Clinical is ready.\nE-mail: ${email}\nPassword: ${password}\n\nLog in at ${process.env.CLIENT_URL}/login and change your password from your profile.`
  );

  res.status(201).json({ data: user });
}

// GET /api/admin/doctors?q= – all doctors, searchable by name or e-mail
export async function listDoctors(req, res) {
  const q = req.query.q || "";

  const doctors = await prisma.user.findMany({
    where: {
      role: "doctor",
      OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }],
    },
    omit: { password: true },
    include: { doctor: { include: { specialty: true, clinic: true } } },
    orderBy: { name: "asc" },
  });

  res.json({ data: doctors });
}

// PUT /api/admin/doctors/:id – edit a doctor (a new card file is optional)
export async function updateDoctor(req, res) {
  const id = Number(req.params.id);
  const { name, phone, bio } = req.body;
  const { specialtyId, fee, dailyLimit } = doctorNumbers(req.body);

  if (!name || !specialtyId) {
    return res.status(400).json({ message: "Name and specialty are required" });
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: id } });
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const doctorData = { specialtyId, bio, fee, dailyLimit };
  if (req.file) {
    doctorData.syndicateCard = `/uploads/${req.file.filename}`;
  }

  const user = await prisma.user.update({
    where: { id },
    data: { name, phone, doctor: { update: doctorData } },
    omit: { password: true },
    include: { doctor: { include: { specialty: true } } },
  });

  res.json({ data: user });
}

// DELETE /api/admin/doctors/:id – remove a doctor and everything linked to him
export async function deleteDoctor(req, res) {
  const id = Number(req.params.id);

  const doctor = await prisma.doctor.findUnique({ where: { userId: id } });
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  await prisma.user.delete({ where: { id } });
  res.json({ data: { id } });
}

// ---------- Patients ----------

// GET /api/admin/patients?q= – all patients, searchable by name or e-mail
export async function listPatients(req, res) {
  const q = req.query.q || "";

  const patients = await prisma.user.findMany({
    where: {
      role: "patient",
      OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }],
    },
    omit: { password: true },
    include: { patient: { include: { _count: { select: { appointments: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({ data: patients });
}

// PATCH /api/admin/patients/:id/block – block an active patient, or unblock a blocked one
export async function toggleBlock(req, res) {
  const id = Number(req.params.id);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "patient") {
    return res.status(404).json({ message: "Patient not found" });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: user.status === "active" ? "blocked" : "active" },
    omit: { password: true },
  });

  res.json({ data: updated });
}

// ---------- Specialties ----------

// GET /api/specialties – everyone can read the list (used by search filters)
export async function listSpecialties(req, res) {
  const specialties = await prisma.specialty.findMany({
    include: { _count: { select: { doctors: true } } },
    orderBy: { name: "asc" },
  });

  res.json({ data: specialties });
}

// POST /api/specialties – add a specialty
export async function createSpecialty(req, res) {
  const name = (req.body.name || "").trim();

  if (!name) {
    return res.status(400).json({ message: "Specialty name is required" });
  }

  const exists = await prisma.specialty.findUnique({ where: { name } });
  if (exists) {
    return res.status(400).json({ message: "This specialty already exists" });
  }

  const specialty = await prisma.specialty.create({ data: { name } });
  res.status(201).json({ data: specialty });
}

// DELETE /api/specialties/:id – only if no doctor uses it
export async function deleteSpecialty(req, res) {
  const id = Number(req.params.id);

  const doctorsCount = await prisma.doctor.count({ where: { specialtyId: id } });
  if (doctorsCount > 0) {
    return res.status(400).json({ message: "Doctors still use this specialty. Move them to another specialty first" });
  }

  await prisma.specialty.delete({ where: { id } });
  res.json({ data: { id } });
}

// ---------- Statistics ----------

// GET /api/admin/stats – simple numbers for the admin home page
export async function getStats(req, res) {
  const [doctors, patients, blockedPatients, specialties, appointments, todayAppointments, byStatus] =
    await Promise.all([
      prisma.user.count({ where: { role: "doctor" } }),
      prisma.user.count({ where: { role: "patient" } }),
      prisma.user.count({ where: { role: "patient", status: "blocked" } }),
      prisma.specialty.count(),
      prisma.appointment.count(),
      prisma.appointment.count({ where: { date: today(), status: { not: "cancelled" } } }),
      prisma.appointment.groupBy({ by: ["status"], _count: true }),
    ]);

  // [{ status: "confirmed", _count: 4 }, ...] -> { confirmed: 4, ... }
  const statusCounts = { confirmed: 0, completed: 0, cancelled: 0, no_show: 0 };
  byStatus.forEach((row) => (statusCounts[row.status] = row._count));

  res.json({
    data: { doctors, patients, blockedPatients, specialties, appointments, todayAppointments, statusCounts },
  });
}
