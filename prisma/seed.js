// Seed: creates the admin, the specialties and some demo data.
// Run with: npm run db:seed
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const specialtyNames = [
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Dentistry",
  "Orthopedics",
  "Ophthalmology",
  "ENT",
  "Neurology",
  "Internal Medicine",
  "Gynecology",
];

// Demo doctors: [name, e-mail, specialty, fee, area, latitude, longitude]
const demoDoctors = [
  ["Ahmed Hassan", "doctor@clinical.com", "Cardiology", 400, "Nasr City, Cairo", 30.0561, 31.3301],
  ["Sara Mahmoud", "sara@clinical.com", "Cardiology", 350, "Heliopolis, Cairo", 30.0911, 31.3225],
  ["Omar Khaled", "omar@clinical.com", "Dermatology", 300, "Maadi, Cairo", 29.9602, 31.2569],
  ["Mona Ali", "mona@clinical.com", "Pediatrics", 250, "Dokki, Giza", 30.0385, 31.2123],
  ["Youssef Ibrahim", "youssef@clinical.com", "Dentistry", 200, "Nasr City, Cairo", 30.0626, 31.3449],
  ["Nour Adel", "nour@clinical.com", "Pediatrics", 300, "Zamalek, Cairo", 30.0609, 31.2197],
];

async function main() {
  // 1. The admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@clinical.com" },
    update: {},
    create: {
      name: "Clinical Admin",
      email: "admin@clinical.com",
      password: await bcrypt.hash("Admin@123", 10),
      role: "admin",
    },
  });

  // 2. Specialties
  for (const name of specialtyNames) {
    await prisma.specialty.upsert({ where: { name }, update: {}, create: { name } });
  }

  // 3. Demo data (only the first time)
  if ((await prisma.doctor.count()) > 0) {
    console.log("Demo data already exists – skipped.");
    return;
  }

  const doctorPassword = await bcrypt.hash("Doctor@123", 10);
  for (const [name, email, specialtyName, fee, area, latitude, longitude] of demoDoctors) {
    const specialty = await prisma.specialty.findUnique({ where: { name: specialtyName } });
    await prisma.user.create({
      data: {
        name,
        email,
        phone: "01000000000",
        password: doctorPassword,
        role: "doctor",
        doctor: {
          create: {
            specialtyId: specialty.id,
            bio: `Consultant of ${specialtyName} with more than 10 years of experience.`,
            fee,
            dailyLimit: 12,
            syndicateCard: "/uploads/demo-card.pdf",
            addedById: admin.id,
            clinic: {
              create: {
                name: `Dr. ${name.split(" ")[0]}'s Clinic`,
                address: area,
                latitude,
                longitude,
                phone: "01000000000",
                whatsapp: "201000000000",
                facebook: "https://facebook.com",
                instagram: "https://instagram.com",
              },
            },
            // Sunday to Thursday, 10:00 to 16:00, every 30 minutes
            schedules: {
              create: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
                dayOfWeek,
                startTime: "10:00",
                endTime: "16:00",
                slotMinutes: 30,
              })),
            },
          },
        },
      },
    });
  }

  await prisma.user.create({
    data: {
      name: "Mariam Youssef",
      email: "patient@clinical.com",
      phone: "01111111111",
      password: await bcrypt.hash("Patient@123", 10),
      role: "patient",
      patient: { create: { dateOfBirth: "1998-05-10", gender: "female" } },
    },
  });

  console.log("Seed done.");
  console.log("Admin:   admin@clinical.com   / Admin@123");
  console.log("Doctor:  doctor@clinical.com  / Doctor@123");
  console.log("Patient: patient@clinical.com / Patient@123");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
