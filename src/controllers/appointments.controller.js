// Module 3 – Appointments: book, my appointments, cancel, alternatives and waiting list
import prisma from "../prisma.js";
import { notify } from "../utils/notify.js";
import { sendEmail } from "../utils/email.js";
import { friendlyDate, getSlots, hasFreeSlot, isDate, isTime, today } from "../utils/slots.js";
import { toDoctorCard } from "./doctors.controller.js";

const WAITING_MINUTES = 30; // a notified patient has 30 minutes to book

// Tells the first waiting patient that a time is free now
async function notifyNextInLine(doctorId, date) {
  const next = await prisma.waitingList.findFirst({
    where: { doctorId, date, status: "waiting" },
    orderBy: { position: "asc" },
  });
  if (!next) return;

  await prisma.waitingList.update({
    where: { id: next.id },
    data: { status: "notified", notifiedAt: new Date() },
  });
  await notify(
    next.patientId,
    "A time is free now",
    `A time became free on ${friendlyDate(date)}. Book it within ${WAITING_MINUTES} minutes.`,
    `/doctors/${doctorId}?date=${date}`
  );
}

// After a booking: mark the patient's waiting-list place as booked (or expired if he was late)
async function updateWaitingAfterBooking(patientId, doctorId, date) {
  const entry = await prisma.waitingList.findFirst({
    where: { patientId, doctorId, date, status: { in: ["waiting", "notified"] } },
  });
  if (!entry) return;

  const minutesPassed = entry.notifiedAt ? (Date.now() - entry.notifiedAt.getTime()) / 60000 : 0;
  const status = minutesPassed > WAITING_MINUTES ? "expired" : "booked";
  await prisma.waitingList.update({ where: { id: entry.id }, data: { status } });
}

// POST /api/appointments – a patient books a free time
export async function bookAppointment(req, res) {
  const doctorId = Number(req.body.doctorId);
  const { date, time } = req.body;
  const patientId = req.user.id;

  if (!doctorId || !isDate(date) || !isTime(time)) {
    return res.status(400).json({ message: "Please choose a doctor, a day and a time" });
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: doctorId }, include: { user: true } });
  if (!doctor || doctor.user.status !== "active") {
    return res.status(404).json({ message: "Doctor not found" });
  }

  // 1. Is the day open, not full, and is the time free?
  const { slots, full, closed } = await getSlots(doctorId, date);
  if (closed) {
    return res.status(400).json({ message: "The doctor does not work on this day" });
  }
  if (full) {
    return res.status(409).json({ message: "This day is fully booked", full: true });
  }
  const slot = slots.find((s) => s.time === time);
  if (!slot || slot.taken) {
    return res.status(409).json({ message: "This time is already taken. Please choose another time" });
  }

  // 2. One appointment per patient with the same doctor on the same day
  const already = await prisma.appointment.findFirst({
    where: { patientId, doctorId, date, status: { not: "cancelled" } },
  });
  if (already) {
    return res.status(409).json({ message: "You already have an appointment with this doctor on this day" });
  }

  // 3. A cancelled appointment frees its time: remove the old row so the unique key allows the new one
  await prisma.appointment.deleteMany({ where: { doctorId, date, time, status: "cancelled" } });

  // 4. Create it. The unique key (doctorId + date + time) also stops double booking.
  let appointment;
  try {
    appointment = await prisma.appointment.create({ data: { patientId, doctorId, date, time } });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ message: "This time is already taken. Please choose another time" });
    }
    throw err;
  }

  await updateWaitingAfterBooking(patientId, doctorId, date);

  // 5. Tell the patient and the doctor
  await notify(patientId, "Appointment booked", `Your appointment with Dr. ${doctor.user.name} is on ${friendlyDate(date, time)}.`, "/my-appointments");
  await notify(doctorId, "New appointment", `${req.user.name} booked ${friendlyDate(date, time)}.`, `/doctor?date=${date}`);
  await sendEmail(
    req.user.email,
    "Your appointment is booked",
    `Hello ${req.user.name},\n\nYour appointment with Dr. ${doctor.user.name} is booked for ${friendlyDate(date, time)}.\n\nClinical`
  );

  res.status(201).json({ data: appointment });
}

// GET /api/appointments/me – the patient's appointments (newest first)
export async function myAppointments(req, res) {
  const appointments = await prisma.appointment.findMany({
    where: { patientId: req.user.id },
    include: {
      doctor: { include: { user: { select: { name: true } }, specialty: true, clinic: true } },
      review: true,
      diagnosis: { select: { id: true } },
    },
    orderBy: [{ date: "desc" }, { time: "desc" }],
  });

  res.json({ data: appointments });
}

// PATCH /api/appointments/:id/cancel – the patient cancels his own upcoming appointment
export async function cancelAppointment(req, res) {
  const id = Number(req.params.id);

  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment || appointment.patientId !== req.user.id) {
    return res.status(404).json({ message: "Appointment not found" });
  }
  if (appointment.status !== "confirmed" || appointment.date < today()) {
    return res.status(400).json({ message: "Only upcoming appointments can be cancelled" });
  }

  const updated = await prisma.appointment.update({ where: { id }, data: { status: "cancelled" } });

  await notify(
    appointment.doctorId,
    "Appointment cancelled",
    `${req.user.name} cancelled the appointment on ${friendlyDate(appointment.date, appointment.time)}.`,
    `/doctor?date=${appointment.date}`
  );
  await notifyNextInLine(appointment.doctorId, appointment.date);

  res.json({ data: updated });
}

// GET /api/doctors/:id/alternatives?date= – up to 5 doctors of the same specialty who are free that day
export async function getAlternatives(req, res) {
  const id = Number(req.params.id);
  const { date } = req.query;

  if (!isDate(date)) {
    return res.status(400).json({ message: "Please choose a valid date" });
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: id } });
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const sameSpecialty = await prisma.doctor.findMany({
    where: { specialtyId: doctor.specialtyId, userId: { not: id }, user: { status: "active" } },
    include: { user: { select: { name: true } }, specialty: true, clinic: true },
  });

  const alternatives = [];
  for (const other of sameSpecialty) {
    if (alternatives.length === 5) break;
    if (await hasFreeSlot(other.userId, date)) {
      alternatives.push(toDoctorCard(other, null, date));
    }
  }

  res.json({ data: alternatives });
}

// POST /api/waiting-list – join the waiting list of a full day
export async function joinWaitingList(req, res) {
  const doctorId = Number(req.body.doctorId);
  const { date } = req.body;
  const patientId = req.user.id;

  if (!doctorId || !isDate(date)) {
    return res.status(400).json({ message: "Please choose a doctor and a day" });
  }

  const already = await prisma.waitingList.findFirst({
    where: { patientId, doctorId, date, status: { in: ["waiting", "notified"] } },
  });
  if (already) {
    return res.status(400).json({ message: `You are already on the waiting list (number ${already.position})` });
  }

  const count = await prisma.waitingList.count({ where: { doctorId, date } });
  const entry = await prisma.waitingList.create({
    data: { patientId, doctorId, date, position: count + 1 },
  });

  res.status(201).json({ data: entry });
}

// GET /api/waiting-list/me – the patient's places on waiting lists
export async function myWaitingList(req, res) {
  const entries = await prisma.waitingList.findMany({
    where: { patientId: req.user.id },
    include: { doctor: { include: { user: { select: { name: true } }, specialty: true } } },
    orderBy: { date: "desc" },
  });

  res.json({ data: entries });
}
