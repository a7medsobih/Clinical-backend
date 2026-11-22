// One Prisma client for the whole app. Import it wherever you need the database.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default prisma;
