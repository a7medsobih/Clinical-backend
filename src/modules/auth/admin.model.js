import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false,
        },
        role: {
            type: String,
            default: "admin",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLoginAt: Date,
    },
    { timestamps: true }
);

export default mongoose.model("Admin", adminSchema);
