import TeamMember from "./team.model.js";
import Media from "../media/media.model.js";

const resolveMediaInput = async (input) => {
    const { mediaId, ...data } = input;
    if (mediaId === undefined) {
        return data.image === undefined ? data : { ...data, media: null };
    }

    const media = await Media.findById(mediaId);
    if (!media || media.type !== "image") {
        const error = new Error("An existing image mediaId is required");
        error.status = 400;
        throw error;
    }

    return { ...data, media: media._id, image: media.url };
};

export const listTeamMembers = async ({ page, limit, search, isActive }) => {
    const filter = {};

    if (typeof isActive === "boolean") filter.isActive = isActive;
    if (search) {
        const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [
            { "name.ar": expression },
            { "name.en": expression },
            { "jobTitle.ar": expression },
            { "jobTitle.en": expression },
        ];
    }

    const skip = (page - 1) * limit;
    const [members, total] = await Promise.all([
        TeamMember.find(filter).sort({ order: 1, createdAt: 1 }).skip(skip).limit(limit),
        TeamMember.countDocuments(filter),
    ]);

    return { members, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getTeamMemberById = (id) => TeamMember.findById(id);

export const createTeamMember = async (input) => TeamMember.create(await resolveMediaInput(input));

export const updateTeamMember = async (id, input) =>
    TeamMember.findByIdAndUpdate(id, await resolveMediaInput(input), { new: true, runValidators: true });

export const deleteTeamMember = (id) => TeamMember.findByIdAndDelete(id);

export const toggleTeamMember = async (id) => {
    const member = await TeamMember.findById(id);
    if (!member) return null;

    member.isActive = !member.isActive;
    return member.save();
};

export const reorderTeamMembers = async (items) => {
    const ids = items.map(({ id }) => id);
    const existingCount = await TeamMember.countDocuments({ _id: { $in: ids } });

    if (existingCount !== ids.length) return false;

    await TeamMember.bulkWrite(
        items.map(({ id, order }) => ({
            updateOne: { filter: { _id: id }, update: { $set: { order } } },
        }))
    );

    return true;
};

export const listPublicTeamMembers = () =>
    TeamMember.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
