// verifyToken: checks the login token and puts the user in req.user
// allowRoles:  lets only some roles use a route, e.g. allowRoles("admin")
import jwt from "jsonwebtoken";
import prisma from "../prisma.js";

export async function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Please log in first" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Your session has ended. Please log in again" });
  }

  // Read the user again, so a removed or blocked user is stopped right away
  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) {
    return res.status(401).json({ message: "Your session has ended. Please log in again" });
  }
  if (user.status === "blocked") {
    return res.status(403).json({ message: "Your account is blocked. Please contact the clinic" });
  }

  req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
  next();
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You are not allowed to do this" });
    }
    next();
  };
}
