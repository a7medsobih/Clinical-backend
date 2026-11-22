// Module 2 – Doctors: search, profile, free slots, clinic and schedule
import prisma from "../prisma.js";
import { addDays, buildSlots, getSlots, isDate, isTime, today } from "../utils/slots.js";

// What we load for every doctor shown to patients
const doctorInclude = {
  user: { select: { name: true, phone: true } },
  specialty: true,
  clinic: true,
  schedules: { orderBy: { dayOfWeek: "asc" } },
};

// Average rating of each doctor -> { [doctorId]: { rating, reviewsCount } }
async function getRatings(doctorIds) {
  const reviews = await prisma.review.findMany({
    where: { appointment: { doctorId: { in: doctorIds } } },
    select: { rating: true, appointment: { select: { doctorId: true } } },
  });

  const ratings = {};
  doctorIds.forEach((id) => {
    const mine = reviews.filter((r) => r.appointment.doctorId === id);
    const total = mine.reduce((sum, r) => sum + r.rating, 0);
    ratings[id] = {
      rating: mine.length ? Number((total / mine.length).toFixed(1)) : null,
      reviewsCount: mine.length,
    };
  });
  return ratings;
}

// The first day in the next 7 days that still has a free time (or null)
function findNextFreeDay(doctor, appointments) {
  for (let i = 0; i < 7; i++) {
    const date = addDays(today(), i);
    const bookedTimes = appointments
      .filter((a) => a.doctorId === doctor.userId && a.date === date)
      .map((a) => a.time);

    const { slots } = buildSlots(doctor, date, bookedTimes);
    if (slots.some((s) => !s.taken)) return date;
  }
  return null;
}

// Turns a doctor row into the simple object the website shows on a card
export function toDoctorCard(doctor, rating, nextFreeDay = null) {
  return {
    id: doctor.userId,
    name: doctor.user.name,
    specialty: doctor.specialty,
    fee: doctor.fee,
    bio: doctor.bio,
    clinicName: doctor.clinic?.name || null,
    area: doctor.clinic?.address || null,
    rating: rating?.rating ?? null,
    reviewsCount: rating?.reviewsCount ?? 0,
    nextFreeDay,
  };
}

// GET /api/doctors?specialty=&name=&area= – search active doctors
export async function searchDoctors(req, res) {
  const { specialty, name, area } = req.query;

  const where = { user: { status: "active" } };
  // mode "insensitive": "sara" also finds "Sara"
  if (specialty) where.specialtyId = Number(specialty);
  if (name) where.user.name = { contains: name, mode: "insensitive" };
  if (area) where.clinic = { address: { contains: area, mode: "insensitive" } };

  const doctors = await prisma.doctor.findMany({ where, include: doctorInclude });
  const ids = doctors.map((d) => d.userId);

  // Load the ratings and the next 7 days of bookings once, for all doctors together
  const ratings = await getRatings(ids);
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: { in: ids },
      date: { gte: today(), lte: addDays(today(), 6) },
      status: { not: "cancelled" },
    },
    select: { doctorId: true, date: true, time: true },
  });

  const cards = doctors.map((d) => toDoctorCard(d, ratings[d.userId], findNextFreeDay(d, appointments)));
  res.json({ data: cards });
}

// GET /api/doctors/:id – full doctor profile with clinic, schedule and latest reviews
export async function getDoctor(req, res) {
  const id = Number(req.params.id);

  const doctor = await prisma.doctor.findUnique({ where: { userId: id }, include: doctorInclude });
  if (!doctor) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  const ratings = await getRatings([id]);
  const reviews = await prisma.review.findMany({
    where: { appointment: { doctorId: id } },
    include: { appointment: { select: { date: true, patient: { select: { user: { select: { name: true } } } } } } },
    orderBy: { id: "desc" },
    take: 5,
  });

  res.json({
    data: {
      ...toDoctorCard(doctor, ratings[id]),
      clinic: doctor.clinic,
      schedules: doctor.schedules,
      dailyLimit: doctor.dailyLimit,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        date: r.appointment.date,
        patientName: r.appointment.patient.user.name.split(" ")[0], // first name only
      })),
    },
  });
}

// GET /api/doctors/:id/slots?date=YYYY-MM-DD – the times of one day
export async function getDoctorSlots(req, res) {
  const id = Number(req.params.id);
  const { date } = req.query;

  if (!isDate(date)) {
    return res.status(400).json({ message: "Please choose a valid date" });
  }

  const result = await getSlots(id, date);
  if (!result) {
    return res.status(404).json({ message: "Doctor not found" });
  }

  res.json({ data: { date, ...result } });
}

// PUT /api/doctors/me/clinic – the doctor saves his clinic details, bio and fee
export async function updateClinic(req, res) {
  const { name, address, latitude, longitude, phone, whatsapp, facebook, instagram, bio, fee } = req.body;

  if (!name || !address) {
    return res.status(400).json({ message: "Clinic name and address are required" });
  }

  const clinicData = {
    name,
    address,
    latitude: latitude === "" || latitude == null ? null : Number(latitude),
    longitude: longitude === "" || longitude == null ? null : Number(longitude),
    phone,
    whatsapp,
    facebook,
    instagram,
  };

  const clinic = await prisma.clinic.upsert({
    where: { doctorId: req.user.id },
    create: { ...clinicData, doctorId: req.user.id },
    update: clinicData,
  });

  await prisma.doctor.update({
    where: { userId: req.user.id },
    data: { bio, fee: Number(fee) || 0 },
  });

  res.json({ data: clinic });
}

// PUT /api/doctors/me/schedule – replaces the working days, slot length and daily limit
// Body: { days: [{ dayOfWeek: 0, startTime: "09:00", endTime: "17:00" }], slotMinutes: 20, dailyLimit: 20 }
export async function updateSchedule(req, res) {
  const days = req.body.days || [];
  const slotMinutes = Number(req.body.slotMinutes);
  const dailyLimit = Number(req.body.dailyLimit);

  if (!slotMinutes || slotMinutes < 5 || slotMinutes > 120) {
    return res.status(400).json({ message: "The appointment length must be between 5 and 120 minutes" });
  }
  if (!dailyLimit || dailyLimit < 1) {
    return res.status(400).json({ message: "The daily limit must be at least 1" });
  }
  for (const day of days) {
    if (!isTime(day.startTime) || !isTime(day.endTime) || day.startTime >= day.endTime) {
      return res.status(400).json({ message: "Each working day needs a start time before its end time" });
    }
  }

  // Delete the old schedule and save the new one together
  await prisma.$transaction([
    prisma.schedule.deleteMany({ where: { doctorId: req.user.id } }),
    prisma.schedule.createMany({
      data: days.map((day) => ({
        doctorId: req.user.id,
        dayOfWeek: Number(day.dayOfWeek),
        startTime: day.startTime,
        endTime: day.endTime,
        slotMinutes,
      })),
    }),
    prisma.doctor.update({ where: { userId: req.user.id }, data: { dailyLimit } }),
  ]);

  const schedules = await prisma.schedule.findMany({
    where: { doctorId: req.user.id },
    orderBy: { dayOfWeek: "asc" },
  });
  res.json({ data: { schedules, slotMinutes, dailyLimit } });
}
