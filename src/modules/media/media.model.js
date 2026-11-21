import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
    {
        url: { type: String, required: true, trim: true },
        publicId: { type: String, required: true, unique: true, trim: true },
        type: { type: String, enum: ["image", "file"], required: true },
        folder: { type: String, required: true, trim: true },
        size: { type: Number, required: true, min: 0 },
        mimeType: { type: String, required: true, trim: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("Media", mediaSchema);
