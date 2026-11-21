// src/server.js
import "dotenv/config";

import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5001;

if (process.env.NODE_ENV !== "production") {
    const startServer = async () => {
        try {
            await connectDB();

            app.listen(PORT, "0.0.0.0", () => {
                console.log(`Server running on port ${PORT}`);
                console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
            });
        } catch (error) {
            console.error("Failed to start server:", error.message);
            process.exit(1);
        }
    };

    startServer();
}

// Vercel invokes this handler for every request. Ensure the database is ready
// before Express reaches a route that uses a model.
export default async function handler(req, res) {
    try {
        await connectDB();
        return app(req, res);
    } catch (error) {
        console.error("Database connection failed:", error.message);
        return res.status(503).json({
            success: false,
            message: "Service temporarily unavailable",
        });
    }
}
