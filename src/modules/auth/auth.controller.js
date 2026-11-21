import { signAccessToken } from "../../config/auth.js";
import Admin from "./admin.model.js";

import { changePasswordSchema, loginSchema } from "./auth.schema.js";
import { comparePassword, hashPassword } from "./auth.service.js";

const invalidCredentials = (res) =>
    res.status(401).json({ success: false, message: "Invalid email or password" });

const parseBody = (schema, body, res) => {
    const result = schema.safeParse(body);
    if (!result.success) {
        res.status(400).json({ success: false, message: "Invalid request data" });
        return null;
    }
    return result.data;
};

export const login = async (req, res, next) => {
    try {
        const input = parseBody(loginSchema, req.body, res);
        if (!input) return;

        const admin = await Admin.findOne({ email: input.email }).select("+passwordHash");
        if (!admin || !admin.isActive || !(await comparePassword(input.password, admin.passwordHash))) {
            return invalidCredentials(res);
        }

        admin.lastLoginAt = new Date();
        await admin.save();

        return res.status(200).json({
            success: true,
            message: "Logged in successfully",
            data: { accessToken: signAccessToken(admin) },
        });
    } catch (error) {
        return next(error);
    }
};

export const logout = (req, res) => {
    // JWTs are stateless: the client must discard the token. Server-side revocation
    // before expiry requires an additional mechanism such as a token deny-list.
    return res.status(200).json({ success: true, message: "Logged out successfully" });
};

export const me = (req, res) =>
    res.status(200).json({
        success: true,
        data: { admin: req.admin.toJSON() },
    });

export const changePassword = async (req, res, next) => {
    try {
        const input = parseBody(changePasswordSchema, req.body, res);
        if (!input) return;

        const admin = await Admin.findById(req.admin._id).select("+passwordHash");
        if (!admin || !(await comparePassword(input.currentPassword, admin.passwordHash))) {
            return res.status(400).json({ success: false, message: "Current password is incorrect" });
        }

        admin.passwordHash = await hashPassword(input.newPassword);
        await admin.save();
        return res.status(200).json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        return next(error);
    }
};
