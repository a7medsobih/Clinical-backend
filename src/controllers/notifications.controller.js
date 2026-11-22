// Module 5 – Notifications + doctor dashboard + the daily reminder job
import cron from "node-cron";
import prisma from "../prisma.js";
import { notify } from "../utils/notify.js";
import { sendEmail } from "../utils/email.js";
import { addDays, friendlyDate, isDate, today } from "../utils/slots.js";

// ---------- Notifications ----------

// GET /api/notifications – my latest 30 notifications and the unread count
export async function listNotifications(req, res) {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, isRead: false } });

  res.json({ data: { notifications, unreadCount } });
}

// PATCH /api/notifications/:id/read – mark one notification as read
export async function markRead(req, res) {
  const id = Number(req.params.id);

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== req.user.id) {
    return res.status(404).json({ message: "Notification not found" });
  }

  const updated = await prisma.notification.update({ where: { id }, data: { isRead: true } });
  res.json({ data: updated });
}

// PATCH /api/notifications/read-all – mark all my notifications as read
export async function markAllRead(req, res) {
  await prisma.notification.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ data: { ok: true } });
}

// ---------- Doctor dashboard ----------

// GET /api/doctors/me/appointments?date= – the doctor's list of one day (today by default)
export async function doctorAppointments(req, res) {
  const date = req.query.date || today();

  if (!isDate(date)) {
    return res.status(400).json({ message: "Please choose a valid date" });
  }

  const appointments = await prisma.appointment.findMany({
    where: { doctorId: req.user.id, date },
    include: {
      patient: { include: { user: { select: { name: true, phone: true } } } },
      diagnosis: { select: { id: true } },
    },
    orderBy: { time: "asc" },
  });

  res.json({ data: appointments });
}

// PATCH /api/appointments/:id/status – the doctor marks a visit (completed / no_show / confirmed)
export async function updateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!["confirmed", "completed", "no_show"].includes(status)) {
    return res.status(400).json({ message: "Unknown status" });
  }

  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment || appointment.doctorId !== req.user.id) {
    return res.status(404).json({ message: "Appointment not found" });
  }
  if (appointment.status === "cancelled") {
    return res.status(400).json({ message: "This appointment was cancelled" });
  }

  const updated = await prisma.appointment.update({ where: { id }, data: { status } });
  res.json({ data: updated });
}

// GET /api/doctors/me/stats – numbers and a 7-day chart for the doctor's reports page
export async function doctorStats(req, res) {
  const doctorId = req.user.id;

  const byStatus = await prisma.appointment.groupBy({
    by: ["status"],
    where: { doctorId },
    _count: true,
  });
  const statusCounts = { confirmed: 0, completed: 0, cancelled: 0, no_show: 0 };
  byStatus.forEach((row) => (statusCounts[row.status] = row._count));

  // Appointments per day for the last 7 days (cancelled ones are not counted)
  const from = addDays(today(), -6);
  const recent = await prisma.appointment.findMany({
    where: { doctorId, date: { gte: from, lte: today() }, status: { not: "cancelled" } },
    select: { date: true },
  });
  const lastSevenDays = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(from, i);
    lastSevenDays.push({ date, count: recent.filter((a) => a.date === date).length });
  }

  const reviews = await prisma.review.findMany({
    where: { appointment: { doctorId } },
    select: { rating: true },
  });
  const averageRating = reviews.length
    ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1))
    : null;

  const todayCount = await prisma.appointment.count({
    where: { doctorId, date: today(), status: { not: "cancelled" } },
  });

  res.json({
    data: { statusCounts, lastSevenDays, averageRating, reviewsCount: reviews.length, todayCount },
  });
}

// ---------- Reminder job ----------

// Notifies and e-mails every patient who has an appointment tomorrow
export async function sendReminders() {
  const tomorrow = addDays(today(), 1);

  const appointments = await prisma.appointment.findMany({
    where: { date: tomorrow, status: "confirmed" },
    include: {
      patient: { include: { user: true } },
      doctor: { include: { user: true, clinic: true } },
    },
  });

  for (const a of appointments) {
    const when = friendlyDate(a.date, a.time);
    const place = a.doctor.clinic ? ` at ${a.doctor.clinic.name}, ${a.doctor.clinic.address}` : "";
    const message = `Reminder: your appointment with Dr. ${a.doctor.user.name} is tomorrow, ${when}${place}.`;

    await notify(a.patientId, "Appointment tomorrow", message, "/my-appointments");
    await sendEmail(a.patient.user.email, "Reminder: your appointment is tomorrow", `Hello ${a.patient.user.name},\n\n${message}\n\nClinical`);
  }

  console.log(`Reminders sent: ${appointments.length}`);
}

// Runs sendReminders every day at 8 pm
export function startReminderJob() {
  cron.schedule("0 20 * * *", sendReminders);
}
