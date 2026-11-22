// Date / time helpers and the free-slots logic.
// Dates are "YYYY-MM-DD" strings and times are "HH:MM" strings.
import prisma from "../prisma.js";

// Checks the format of a date ("2026-11-15") and a time ("09:20")
export const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");
export const isTime = (value) => /^\d{2}:\d{2}$/.test(value || "");

// "09:20" -> 560 minutes, and back
export function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
export function toTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// A JavaScript Date -> "YYYY-MM-DD" (local time)
function toDateString(d) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export const today = () => toDateString(new Date());
export const nowTime = () => toTime(new Date().getHours() * 60 + new Date().getMinutes());

// "2026-11-15" + 1 day -> "2026-11-16"
export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

// "2026-11-15", "10:20" -> "Sun 15 Nov, 10:20" (used in e-mails and notifications)
export function friendlyDate(date, time) {
  const text = new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return time ? `${text}, ${time}` : text;
}

// 0 = Sunday ... 6 = Saturday
export const dayOfWeek = (date) => new Date(`${date}T00:00:00`).getDay();

// Builds the time list for one day. bookedTimes = times that are already taken.
// Returns { slots: [{ time, taken }], full, closed }
export function buildSlots(doctor, date, bookedTimes) {
  const schedule = doctor.schedules.find((s) => s.dayOfWeek === dayOfWeek(date));

  // The doctor does not work on this day (or the day is in the past)
  if (!schedule || date < today()) {
    return { slots: [], full: false, closed: true };
  }

  // The daily limit is reached: the day is full
  if (bookedTimes.length >= doctor.dailyLimit) {
    return { slots: [], full: true, closed: false };
  }

  const slots = [];
  const end = toMinutes(schedule.endTime);
  for (let m = toMinutes(schedule.startTime); m + schedule.slotMinutes <= end; m += schedule.slotMinutes) {
    const time = toTime(m);
    const isPast = date === today() && time <= nowTime();
    slots.push({ time, taken: bookedTimes.includes(time) || isPast });
  }

  // Every time is booked by patients: the day is full too
  const allBooked = slots.length > 0 && slots.every((s) => bookedTimes.includes(s.time));
  if (allBooked) {
    return { slots: [], full: true, closed: false };
  }

  return { slots, full: false, closed: false };
}

// Reads the doctor and his booked times from the database, then builds the slots.
// Returns null if the doctor does not exist.
export async function getSlots(doctorId, date) {
  const doctor = await prisma.doctor.findUnique({
    where: { userId: doctorId },
    include: { schedules: true },
  });
  if (!doctor) return null;

  const booked = await prisma.appointment.findMany({
    where: { doctorId, date, status: { not: "cancelled" } },
    select: { time: true },
  });

  return buildSlots(doctor, date, booked.map((a) => a.time));
}

// True if the doctor still has at least one free time on this date
export async function hasFreeSlot(doctorId, date) {
  const result = await getSlots(doctorId, date);
  return Boolean(result && result.slots.some((s) => !s.taken));
}
