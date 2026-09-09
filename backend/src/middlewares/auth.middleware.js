import jwt from "jsonwebtoken";
import httpStatus from "http-status";

export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || typeof authHeader !== "string") {
        return res.status(httpStatus.UNAUTHORIZED).json({
            message: "Authentication token required"
        });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(httpStatus.UNAUTHORIZED).json({
            message: "Invalid token format. Expected 'Bearer <token>'"
        });
    }

    const token = parts[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        console.error("[SECURITY WARNING] JWT_SECRET is not configured in environment variables.");
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Authentication service misconfigured"
        });
    }

    try {
        const decoded = jwt.verify(token, secret);
        
        // Ensure expected identity payload exists
        if (!decoded || !decoded.id || !decoded.username) {
            return res.status(httpStatus.UNAUTHORIZED).json({
                message: "Malformed token payload"
            });
        }

        req.user = {
            id: decoded.id,
            username: decoded.username,
            name: decoded.name || decoded.username
        };

        next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(httpStatus.UNAUTHORIZED).json({
                message: "Authentication token has expired. Please log in again."
            });
        }
        return res.status(httpStatus.UNAUTHORIZED).json({
            message: "Invalid authentication token"
        });
    }
};

// Optional auth middleware for routes that can work for both logged-in users and guests
export const optionalAuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== "string") {
        req.user = null;
        return next();
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        req.user = null;
        return next();
    }

    const token = parts[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, secret);
        if (decoded && decoded.id && decoded.username) {
            req.user = {
                id: decoded.id,
                username: decoded.username,
                name: decoded.name || decoded.username
            };
        } else {
            req.user = null;
        }
    } catch (err) {
        req.user = null;
    }
    next();
};
