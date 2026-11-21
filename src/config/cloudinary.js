import { v2 as cloudinary } from "cloudinary";

const requiredVariables = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
];

export const getCloudinary = () => {
    const missing = requiredVariables.filter((name) => !process.env[name]);
    if (missing.length) {
        const error = new Error(`Cloudinary configuration is missing: ${missing.join(", ")}`);
        error.status = 500;
        throw error;
    }

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    return cloudinary;
};
