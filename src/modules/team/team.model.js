import mongoose from "mongoose";

const localizedTextSchema = new mongoose.Schema(
    {
        ar: { type: String, required: true, trim: true },
        en: { type: String, required: true, trim: true },
    },
    { _id: false }
);

const teamMemberSchema = new mongoose.Schema(
    {
        name: { type: localizedTextSchema, required: true },
        jobTitle: { type: localizedTextSchema, required: true },
        company: { type: localizedTextSchema, required: true },
        image: { type: String, trim: true },
        media: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Media",
            default: null,
        },
        bio: { type: localizedTextSchema, required: true },
        order: { type: Number, default: 0, min: 0 },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

teamMemberSchema.index({ isActive: 1, order: 1 });

export default mongoose.model("TeamMember", teamMemberSchema);
