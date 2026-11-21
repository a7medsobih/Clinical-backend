// src/config/db.js
import mongoose from "mongoose";

let connectionPromise;

const connectDB = async () => {
    const { MONGODB_URI } = process.env;

    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI is missing from environment variables");
    }

    // A Vercel function can be reused for several requests. Reuse its existing
    // Mongoose connection instead of opening a new connection on every request.
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (!connectionPromise) {
        connectionPromise = mongoose.connect(MONGODB_URI)
            .then(() => {
                console.log(`MongoDB connected: ${mongoose.connection.host}`);
                return mongoose.connection;
            })
            .catch((error) => {
                connectionPromise = undefined;
                throw error;
            });
    }

    return connectionPromise;
};

export default connectDB;
