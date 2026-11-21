import { verifyAccessToken } from "../config/auth.js";
import Admin from "../modules/auth/admin.model.js";

export default async function requireAuth(req, res, next) {
    const authorization = req.get("authorization") || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    try {
        const payload = verifyAccessToken(token);
        const admin = await Admin.findById(payload.sub);

        if (!admin || !admin.isActive) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        req.admin = admin;
        return next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
}
