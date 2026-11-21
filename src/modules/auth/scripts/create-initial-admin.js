import "dotenv/config";

import mongoose from "mongoose";
import { z } from "zod";

import connectDB from "../../../config/db.js";
import Admin from "../admin.model.js";
import { hashPassword } from "../auth.service.js";

const inputSchema = z.object({
    ADMIN_EMAIL: z.string().trim().email().transform((value) => value.toLowerCase()),
    ADMIN_PASSWORD: z.string().min(8).max(128),
});

try {
    const input = inputSchema.parse({
        ADMIN_EMAIL: process.env.ADMIN_EMAIL,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    });

    await connectDB();
    const existingAdmin = await Admin.findOne({ email: input.ADMIN_EMAIL });

    if (existingAdmin) {
        console.error("An admin with this email already exists. No changes were made.");
        process.exitCode = 1;
    } else {
        await Admin.create({
            email: input.ADMIN_EMAIL,
            passwordHash: await hashPassword(input.ADMIN_PASSWORD),
        });
        console.log("Initial admin created successfully.");
    }
} catch (error) {
    const message = error instanceof z.ZodError
        ? "ADMIN_EMAIL and ADMIN_PASSWORD are required (password: 8-128 characters)."
        : error.message;
    console.error("Could not create initial admin:", message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
