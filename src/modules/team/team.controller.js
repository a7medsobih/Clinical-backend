import {
    adminListQuerySchema,
    createTeamMemberSchema,
    memberIdSchema,
    reorderTeamSchema,
    updateTeamMemberSchema,
} from "./team.schema.js";
import {
    createTeamMember,
    deleteTeamMember,
    getTeamMemberById,
    listPublicTeamMembers,
    listTeamMembers,
    reorderTeamMembers,
    toggleTeamMember,
    updateTeamMember,
} from "./team.service.js";

const parse = (schema, value, res) => {
    const result = schema.safeParse(value);
    if (result.success) return result.data;

    res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
    });
    return null;
};

const notFound = (res) => res.status(404).json({ success: false, message: "Team member not found" });

// Arabic is the public API default. Regional values such as en-US are supported.
const requestLanguage = (req) =>
    (req.get("accept-language") || "").toLowerCase().startsWith("en") ? "en" : "ar";

const localizeMember = (member, language) => ({
    id: member._id,
    name: member.name[language],
    jobTitle: member.jobTitle[language],
    company: member.company[language],
    image: member.image,
    bio: member.bio[language],
    order: member.order,
});

export const listAdminTeamMembers = async (req, res, next) => {
    try {
        const query = parse(adminListQuerySchema, req.query, res);
        if (!query) return;

        const result = await listTeamMembers(query);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return next(error);
    }
};

export const createAdminTeamMember = async (req, res, next) => {
    try {
        const input = parse(createTeamMemberSchema, req.body, res);
        if (!input) return;

        const member = await createTeamMember(input);
        return res.status(201).json({ success: true, data: { member } });
    } catch (error) {
        return next(error);
    }
};

export const getAdminTeamMember = async (req, res, next) => {
    try {
        const params = parse(memberIdSchema, req.params, res);
        if (!params) return;

        const member = await getTeamMemberById(params.id);
        return member
            ? res.status(200).json({ success: true, data: { member } })
            : notFound(res);
    } catch (error) {
        return next(error);
    }
};

export const updateAdminTeamMember = async (req, res, next) => {
    try {
        const params = parse(memberIdSchema, req.params, res);
        const input = parse(updateTeamMemberSchema, req.body, res);
        if (!params || !input) return;

        const member = await updateTeamMember(params.id, input);
        return member
            ? res.status(200).json({ success: true, data: { member } })
            : notFound(res);
    } catch (error) {
        return next(error);
    }
};

export const deleteAdminTeamMember = async (req, res, next) => {
    try {
        const params = parse(memberIdSchema, req.params, res);
        if (!params) return;

        const member = await deleteTeamMember(params.id);
        return member
            ? res.status(200).json({ success: true, message: "Team member deleted successfully" })
            : notFound(res);
    } catch (error) {
        return next(error);
    }
};

export const reorderAdminTeamMembers = async (req, res, next) => {
    try {
        const items = parse(reorderTeamSchema, req.body, res);
        if (!items) return;

        const reordered = await reorderTeamMembers(items);
        if (!reordered) return res.status(404).json({ success: false, message: "One or more team members were not found" });

        return res.status(200).json({ success: true, message: "Team members reordered successfully" });
    } catch (error) {
        return next(error);
    }
};

export const toggleAdminTeamMember = async (req, res, next) => {
    try {
        const params = parse(memberIdSchema, req.params, res);
        if (!params) return;

        const member = await toggleTeamMember(params.id);
        return member
            ? res.status(200).json({ success: true, data: { member } })
            : notFound(res);
    } catch (error) {
        return next(error);
    }
};

export const listPublicTeam = async (req, res, next) => {
    try {
        const language = requestLanguage(req);
        const members = await listPublicTeamMembers();
        return res.status(200).json({
            success: true,
            data: { language, members: members.map((member) => localizeMember(member, language)) },
        });
    } catch (error) {
        return next(error);
    }
};
