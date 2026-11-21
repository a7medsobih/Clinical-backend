import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid member id");

const localizedTextSchema = z.object({
    ar: z.string().trim().min(1).max(200),
    en: z.string().trim().min(1).max(200),
}).strict();

const bioSchema = z.object({
    ar: z.string().trim().min(1).max(5000),
    en: z.string().trim().min(1).max(5000),
}).strict();

const optionalBoolean = z.preprocess((value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
}, z.boolean().optional());

export const memberIdSchema = z.object({ id: objectIdSchema }).strict();

const teamMemberFieldsSchema = z.object({
    name: localizedTextSchema,
    jobTitle: localizedTextSchema,
    company: localizedTextSchema,
    image: z.string().trim().url().max(2048).optional(),
    mediaId: objectIdSchema.optional(),
    bio: bioSchema,
    order: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
}).strict();

export const createTeamMemberSchema = teamMemberFieldsSchema.refine(
    (value) => Boolean(value.image || value.mediaId),
    { message: "image or mediaId is required" }
);

export const updateTeamMemberSchema = teamMemberFieldsSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    { message: "At least one field is required" }
);

export const adminListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    isActive: optionalBoolean,
}).strict();

export const reorderTeamSchema = z.array(
    z.object({
        id: objectIdSchema,
        order: z.number().int().min(0),
    }).strict()
).min(1).max(500).superRefine((items, context) => {
    const ids = new Set();
    const orders = new Set();

    items.forEach((item, index) => {
        if (ids.has(item.id)) {
            context.addIssue({ code: "custom", message: "Duplicate member id", path: [index, "id"] });
        }
        if (orders.has(item.order)) {
            context.addIssue({ code: "custom", message: "Duplicate order value", path: [index, "order"] });
        }
        ids.add(item.id);
        orders.add(item.order);
    });
});
