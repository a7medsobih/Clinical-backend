import jwt from "jsonwebtoken";

const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is missing from environment variables");
    }

    return process.env.JWT_SECRET;
};

export const signAccessToken = (admin) =>
    jwt.sign(
        { sub: admin._id.toString() },
        getJwtSecret(),
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

export const verifyAccessToken = (token) => jwt.verify(token, getJwtSecret());
