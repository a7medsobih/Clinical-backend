// Simple API tests for login, booking and the history rule.
// They use the seeded demo accounts, so run "npm run db:seed" first.
import { jest } from "@jest/globals";
import request from "supertest";
import app from "../src/index.js";
import prisma from "../src/prisma.js";
import { addDays, dayOfWeek, today } from "../src/utils/slots.js";

jest.setTimeout(20000);

let patientToken;
let doctorId;
let bookedId;

// Logs in and returns the token
async function loginAs(email, password) {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.data.token;
}

// The next day (from tomorrow) when the demo doctors work: Sunday to Thursday
function nextWorkingDay() {
  let date = addDays(today(), 1);
  while (dayOfWeek(date) > 4) date = addDays(date, 1);
  return date;
}

beforeAll(async () => {
  patientToken = await loginAs("patient@clinical.com", "Patient@123");
  const doctor = await prisma.user.findUnique({ where: { email: "doctor@clinical.com" } });
  doctorId = doctor.id;
});

afterAll(async () => {
  // Remove what the tests created
  if (bookedId) await prisma.appointment.delete({ where: { id: bookedId } });
  await prisma.notification.deleteMany({ where: { title: { in: ["Appointment booked", "New appointment"] } } });
  await prisma.$disconnect();
});

describe("Login", () => {
  test("returns a token for the right password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "patient@clinical.com", password: "Patient@123" });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.role).toBe("patient");
    expect(res.body.data.user.password).toBeUndefined();
  });

  test("refuses a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "patient@clinical.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });
});

describe("Booking", () => {
  test("books a free time, then refuses the same time again", async () => {
    const date = nextWorkingDay();
    const slotsRes = await request(app).get(`/api/doctors/${doctorId}/slots?date=${date}`);
    const freeSlot = slotsRes.body.data.slots.find((s) => !s.taken);
    expect(freeSlot).toBeTruthy();

    const first = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ doctorId, date, time: freeSlot.time });
    expect(first.status).toBe(201);
    bookedId = first.body.data.id;

    const second = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ doctorId, date, time: freeSlot.time });
    expect(second.status).toBe(409);
  });

  test("a visitor cannot book", async () => {
    const res = await request(app).post("/api/appointments").send({ doctorId, date: nextWorkingDay(), time: "10:00" });
    expect(res.status).toBe(401);
  });
});

describe("History rule", () => {
  test("a doctor sees the history of his own patient", async () => {
    const token = await loginAs("doctor@clinical.com", "Doctor@123");
    const patient = await prisma.user.findUnique({ where: { email: "patient@clinical.com" } });

    const res = await request(app).get(`/api/patients/${patient.id}/history`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test("another doctor gets 403", async () => {
    const token = await loginAs("sara@clinical.com", "Doctor@123");
    const patient = await prisma.user.findUnique({ where: { email: "patient@clinical.com" } });

    const res = await request(app).get(`/api/patients/${patient.id}/history`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
