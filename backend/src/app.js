import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";
import cors from "cors";
import userRoutes from "./routes/users.routes.js";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

const PORT = parseInt(process.env.PORT, 10) || 8000;
app.set("port", PORT);

// Configure CORS
const allowedOrigin = process.env.CORS_ORIGIN 
    ? (process.env.CORS_ORIGIN === "*" ? "*" : process.env.CORS_ORIGIN.split(",").map(s => s.trim()))
    : "*";

app.use(cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));

// Payload limits
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

// Basic security response headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
});

// Health check endpoints for deployment platforms (Render, Railway, ECS, Kubernetes, etc.)
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        dbStatus: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use("/api/v1/users", userRoutes);

// Production Static Asset Serving (optional fullstack serving when frontend/dist is built)
const frontendDistPath = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDistPath) && (process.env.SERVE_STATIC === "true" || process.env.NODE_ENV === "production")) {
    console.log(`[PRODUCTION] Serving frontend static assets from: ${frontendDistPath}`);
    app.use(express.static(frontendDistPath));
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api") || req.path.startsWith("/socket.io") || req.path === "/health") {
            return next();
        }
        res.sendFile(path.join(frontendDistPath, "index.html"));
    });
}

// 404 Handler for API routes
app.use("/api/*", (req, res) => {
    res.status(404).json({ message: "API endpoint not found" });
});

// Centralized error handler
app.use((err, req, res, next) => {
    console.error("Unhandled express error:", err);
    res.status(err.status || 500).json({
        message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message
    });
});

let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`Received ${signal}. Gracefully terminating server...`);

    server.close(async () => {
        console.log("HTTP server closed.");
        try {
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.close();
                console.log("MongoDB connection cleanly closed.");
            }
        } catch (dbCloseErr) {
            console.error("Error closing MongoDB connection:", dbCloseErr);
        }
        process.exit(0);
    });

    setTimeout(() => {
        console.error("Forced termination due to shutdown timeout.");
        process.exit(1);
    }, 10000).unref();
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

const start = async () => {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/connectmeet";

    mongoose.set("bufferCommands", false);
    try {
        const connectionDb = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
            bufferCommands: false
        });
        console.log(`MONGO Connected DB Host: ${connectionDb.connection.host}`);
    } catch (dbError) {
        console.error("MongoDB primary connection failed:", dbError.message);
        try {
            console.log("Attempting connection to local MongoDB fallback...");
            const localDb = await mongoose.connect("mongodb://127.0.0.1:27017/connectmeet", {
                serverSelectionTimeoutMS: 3000
            });
            console.log(`MONGO Connected Local DB Host: ${localDb.connection.host}`);
        } catch (localErr) {
            console.error("MongoDB fallback connection failed. Server will start in degraded mode:", localErr.message);
        }
    }

    server.listen(PORT, "0.0.0.0", () => {
        console.log(`[PRODUCTION] Server listening on port ${PORT} (0.0.0.0:${PORT})`);
    });
};

start();