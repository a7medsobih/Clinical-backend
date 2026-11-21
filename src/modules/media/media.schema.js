import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid media id");

export const mediaIdSchema = z.object({ id: objectIdSchema }).strict();
