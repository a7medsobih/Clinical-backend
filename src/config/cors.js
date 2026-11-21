// src/config/cors.js
import cors from "cors";

const getAllowedOrigins = () => {
    const origins = (process.env.CLIENT_URL || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (process.env.NODE_ENV !== "production") {
        origins.push(
            "http://localhost:3000",
            "http://localhost:5173"
        );
    }

    return [...new Set(origins)];
};

const corsOptions = {
    origin(origin, callback) {
        // Allow Postman, curl, and requests without an Origin header
        if (!origin || getAllowedOrigins().includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
};

export default cors(corsOptions);