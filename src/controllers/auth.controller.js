// Module 1 – Auth: register (patients only), login, read and update my profile
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";

// Creates a login token that holds the user id and role
function createToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// Removes the password before sending a user to the browser
function withoutPassword(user) {
  const { password, ...rest } = user;
  return rest;
}

// POST /api/auth/register – a visitor creates a patient account
export async function register(req, res) {
  const { name, email, password, phone, dateOfBirth, gender } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, e-mail and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "The password must be at least 6 characters" });
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return res.status(400).json({ message: "This e-mail is already registered. Try logging in" });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: await bcrypt.hash(password, 10),
      role: "patient",
      patient: { create: { dateOfBirth, gender } },
    },
  });

  res.status(201).json({ data: { token: createToken(user), user: withoutPassword(user) } });
}

// POST /api/auth/login – returns a token for an active user
export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "E-mail and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: "Wrong e-mail or password" });
  }
  if (user.status === "blocked") {
    return res.status(403).json({ message: "Your account is blocked. Please contact the clinic" });
  }

  res.json({ data: { token: createToken(user), user: withoutPassword(user) } });
}

// GET /api/auth/me – the logged-in user with his patient or doctor details
export async function getMe(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    omit: { password: true },
    include: {
      patient: true,
      doctor: { include: { specialty: true, clinic: true, schedules: true } },
    },
  });

  res.json({ data: user });
}

// PUT /api/auth/me – update name, phone, patient details and (optionally) the password
export async function updateMe(req, res) {
  const { name, phone, dateOfBirth, gender, currentPassword, newPassword } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  const data = { name, phone };

  if (newPassword) {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(currentPassword || "", user.password))) {
      return res.status(400).json({ message: "The current password is not correct" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "The new password must be at least 6 characters" });
    }
    data.password = await bcrypt.hash(newPassword, 10);
  }

  if (req.user.role === "patient") {
    data.patient = { update: { dateOfBirth, gender } };
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
    omit: { password: true },
  });

  res.json({ data: user });
}
