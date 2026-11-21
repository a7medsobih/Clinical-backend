import { Router } from "express";

import requireAuth from "../../middlewares/require-auth.js";
import {
    createAdminTeamMember,
    deleteAdminTeamMember,
    getAdminTeamMember,
    listAdminTeamMembers,
    listPublicTeam,
    reorderAdminTeamMembers,
    toggleAdminTeamMember,
    updateAdminTeamMember,
} from "./team.controller.js";

export const adminTeamRouter = Router();
export const publicTeamRouter = Router();

adminTeamRouter.use(requireAuth);
adminTeamRouter.get("/", listAdminTeamMembers);
adminTeamRouter.post("/", createAdminTeamMember);
adminTeamRouter.patch("/reorder", reorderAdminTeamMembers);
adminTeamRouter.patch("/:id/toggle", toggleAdminTeamMember);
adminTeamRouter.get("/:id", getAdminTeamMember);
adminTeamRouter.patch("/:id", updateAdminTeamMember);
adminTeamRouter.delete("/:id", deleteAdminTeamMember);

publicTeamRouter.get("/", listPublicTeam);
