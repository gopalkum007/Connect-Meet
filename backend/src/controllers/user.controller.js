import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { Meeting } from "../models/meeting.model.js";
import { sendResetPasswordEmail } from "../services/mailService.js";

const getFrontendUrl = (req) => {
    if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL.replace(/\/$/, "");
    }
    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
        try {
            const parsed = new URL(origin);
            return `${parsed.protocol}//${parsed.host}`;
        } catch {
            // fallback
        }
    }
    return process.env.NODE_ENV === "production"
        ? "https://connect-meet-wk21.onrender.com"
        : "http://localhost:5173";
};

const isDbConnected = () => mongoose.connection.readyState === 1;

const login = async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password || typeof username !== "string" || typeof password !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Username and password are required" });
    }

    const trimmedUsername = username.trim().toLowerCase();

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.SERVICE_UNAVAILABLE).json({ message: "Database connection unavailable" });
        }

        const user = await User.findOne({ username: trimmedUsername });
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid username or password" });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("[SECURITY] JWT_SECRET is not configured.");
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Authentication service misconfigured" });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username, name: user.name },
            secret,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        return res.status(httpStatus.OK).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email || "",
                avatar: user.avatar || "",
                preferredLanguage: user.preferredLanguage || "en"
            }
        });

    } catch (e) {
        console.error("Login controller error:", e);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "An error occurred during login" });
    }
};

const register = async (req, res) => {
    const { name, username, password, email } = req.body || {};

    if (!name || !username || !password || 
        typeof name !== "string" || typeof username !== "string" || typeof password !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Name, username, and password are required" });
    }

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (trimmedUsername.length < 3) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Username must be at least 3 characters long" });
    }

    if (password.length < 6) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Password must be at least 6 characters long" });
    }

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.SERVICE_UNAVAILABLE).json({ message: "Database connection unavailable" });
        }
        const existingUser = await User.findOne({ username: trimmedUsername });
        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name: trimmedName,
            username: trimmedUsername,
            password: hashedPassword,
            email: trimmedEmail
        });

        await newUser.save();

        return res.status(httpStatus.CREATED).json({ message: "User registered successfully" });

    } catch (e) {
        console.error("Database Save Error inside Register Controller:", e);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "An error occurred during registration" });
    }
};

// Protected: Identity from req.user
const getUserHistory = async (req, res) => {
    try {
        if (!req.user || !req.user.username) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Authentication required" });
        }

        if (!isDbConnected()) {
            return res.status(httpStatus.OK).json([]);
        }

        const meetings = await Meeting.find({ user_id: req.user.username }).sort({ date: -1 }).limit(100);
        return res.status(httpStatus.OK).json(meetings);
    } catch (e) {
        console.error("getUserHistory error:", e);
        return res.status(httpStatus.OK).json([]);
    }
};

// Protected: Associates meeting with req.user.username
const addToHistory = async (req, res) => {
    const { meeting_code } = req.body || {};

    if (!req.user || !req.user.username) {
        return res.status(httpStatus.UNAUTHORIZED).json({ message: "Authentication required" });
    }

    if (!meeting_code || typeof meeting_code !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Valid meeting_code is required" });
    }

    const cleanCode = meeting_code.trim();

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.OK).json({ message: "Added code to memory history" });
        }

        const existingUserMeeting = await Meeting.findOne({ meetingCode: cleanCode, user_id: req.user.username });
        if (existingUserMeeting) {
            return res.status(httpStatus.OK).json({ message: "Meeting already exists in database", meeting: existingUserMeeting });
        }

        const originalMeeting = await Meeting.findOne({ meetingCode: cleanCode });

        const newMeeting = new Meeting({
            user_id: req.user.username,
            meetingCode: cleanCode,
            title: originalMeeting?.title || "Instant Meeting",
            description: originalMeeting?.description || "",
            scheduledStartTime: originalMeeting?.scheduledStartTime || new Date(),
            scheduledEndTime: originalMeeting?.scheduledEndTime || null,
            status: originalMeeting?.status || "Live",
            chatPermission: originalMeeting?.chatPermission || "Everyone",
            date: new Date()
        });

        await newMeeting.save();

        return res.status(httpStatus.CREATED).json({ message: "Added code to history", meeting: newMeeting });
    } catch (e) {
        console.error("addToHistory error:", e);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to record meeting history" });
    }
};

// Optional / Protected: Sets user_id from req.user if authenticated
const createMeeting = async (req, res) => {
    console.log("[MEETING API] Create request received:", req.body);
    const { meetingCode, title, description, scheduledStartTime, scheduledEndTime, status, chatPermission } = req.body || {};

    const creatorUsername = req.user ? req.user.username : "Guest";
    console.log("[MEETING API] Authenticated user:", creatorUsername);

    // Validate or generate room code
    let cleanCode = meetingCode && typeof meetingCode === "string" ? meetingCode.trim() : "";
    if (!cleanCode) {
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        const randPart = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        cleanCode = `${randPart(3)}-${randPart(4)}-${randPart(3)}`;
    }
    console.log("[MEETING API] Generated room code:", cleanCode);

    try {
        if (!isDbConnected()) {
            const memMeeting = { meetingCode: cleanCode, title: title || "ConnectMeet Meeting", status: status || "Live", chatPermission: chatPermission || "Everyone" };
            const payload = {
                message: "Meeting created in room session",
                meeting: memMeeting,
                meetingCode: cleanCode,
                roomCode: cleanCode,
                url: `/meet/${cleanCode}`,
                meetingUrl: `/meet/${cleanCode}`
            };
            console.log("[MEETING API] Meeting saved (in-memory):", cleanCode);
            console.log("[MEETING API] Response sent:", payload);
            return res.status(httpStatus.CREATED).json(payload);
        }

        let existingMeeting = await Meeting.findOne({ meetingCode: cleanCode });
        if (existingMeeting) {
            // Only creator or host can update the meeting
            if (req.user && existingMeeting.user_id !== "Guest" && existingMeeting.user_id !== req.user.username) {
                return res.status(httpStatus.FORBIDDEN).json({ message: "You do not have permission to update this meeting" });
            }
            existingMeeting.title = title || existingMeeting.title;
            existingMeeting.description = description !== undefined ? description : existingMeeting.description;
            existingMeeting.scheduledStartTime = scheduledStartTime ? new Date(scheduledStartTime) : existingMeeting.scheduledStartTime;
            existingMeeting.scheduledEndTime = scheduledEndTime ? new Date(scheduledEndTime) : existingMeeting.scheduledEndTime;
            existingMeeting.status = status || existingMeeting.status;
            if (chatPermission) existingMeeting.chatPermission = chatPermission;
            await existingMeeting.save();

            const payload = {
                message: "Meeting updated successfully",
                meeting: existingMeeting,
                meetingCode: cleanCode,
                roomCode: cleanCode,
                url: `/meet/${cleanCode}`,
                meetingUrl: `/meet/${cleanCode}`
            };
            console.log("[MEETING API] Meeting saved:", cleanCode);
            console.log("[MEETING API] Response sent:", payload);
            return res.status(httpStatus.OK).json(payload);
        }

        const newMeeting = new Meeting({
            user_id: creatorUsername,
            meetingCode: cleanCode,
            title: title || "ConnectMeet Meeting",
            description: description || "",
            scheduledStartTime: scheduledStartTime ? new Date(scheduledStartTime) : new Date(),
            scheduledEndTime: scheduledEndTime ? new Date(scheduledEndTime) : null,
            status: status || "Live",
            chatPermission: chatPermission || "Everyone",
            date: new Date()
        });

        await newMeeting.save();

        const payload = {
            message: "Meeting created successfully",
            meeting: newMeeting,
            meetingCode: cleanCode,
            roomCode: cleanCode,
            url: `/meet/${cleanCode}`,
            meetingUrl: `/meet/${cleanCode}`
        };
        console.log("[MEETING API] Meeting saved:", cleanCode);
        console.log("[MEETING API] Response sent:", payload);
        return res.status(httpStatus.CREATED).json(payload);
    } catch (e) {
        console.error("[MEETING API] createMeeting error:", e);
        const fallbackPayload = {
            message: "Meeting room active",
            meeting: { meetingCode: cleanCode, title: title || "ConnectMeet Meeting", status: status || "Live" },
            meetingCode: cleanCode,
            roomCode: cleanCode,
            url: `/meet/${cleanCode}`,
            meetingUrl: `/meet/${cleanCode}`
        };
        return res.status(httpStatus.CREATED).json(fallbackPayload);
    }
};

// Public: Fetch meeting information by code for participant lobby
const getMeetingByCode = async (req, res) => {
    const rawCode = req.params.code || req.query.code;

    if (!rawCode || typeof rawCode !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Invalid meeting code" });
    }

    const meetingCode = rawCode.trim();

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.OK).json({
                meetingCode,
                title: "Instant Meeting",
                status: "Live",
                user_id: "Host"
            });
        }
        const meeting = await Meeting.findOne({ meetingCode });
        if (!meeting) {
            return res.status(httpStatus.OK).json({
                meetingCode,
                title: "Instant Meeting",
                status: "Live",
                user_id: "Host"
            });
        }
        return res.status(httpStatus.OK).json(meeting);
    } catch (e) {
        console.error("getMeetingByCode error:", e);
        return res.status(httpStatus.OK).json({
            meetingCode,
            title: "Instant Meeting",
            status: "Live",
            user_id: "Host"
        });
    }
};

// Protected: Updates preferredLanguage for req.user.id
const updateLanguage = async (req, res) => {
    const { language } = req.body || {};

    if (!req.user || !req.user.id) {
        return res.status(httpStatus.UNAUTHORIZED).json({ message: "Authentication required" });
    }

    if (!language || typeof language !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Valid language is required" });
    }

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.SERVICE_UNAVAILABLE).json({ message: "Database connection unavailable" });
        }
        const user = await User.findByIdAndUpdate(req.user.id, { preferredLanguage: language.trim() }, { new: true });
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }
        return res.status(httpStatus.OK).json({ message: "Language updated successfully", language: user.preferredLanguage });
    } catch (e) {
        console.error("updateLanguage error:", e);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to update language" });
    }
};

// Protected: Retrieves profile for authenticated user req.user.id
const getUserProfile = async (req, res) => {
    if (!req.user || !req.user.id) {
        return res.status(httpStatus.UNAUTHORIZED).json({ message: "Authentication required" });
    }

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.SERVICE_UNAVAILABLE).json({ message: "Database connection unavailable" });
        }
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }
        return res.status(httpStatus.OK).json({
            id: user._id,
            name: user.name,
            username: user.username,
            email: user.email || "",
            avatar: user.avatar || "",
            preferredLanguage: user.preferredLanguage || "en"
        });
    } catch (e) {
        console.error("getUserProfile error:", e);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to retrieve profile" });
    }
};

// Protected: Updates profile for authenticated user req.user.id
const updateUserProfile = async (req, res) => {
    const { name, email, avatar } = req.body || {};

    if (!req.user || !req.user.id) {
        return res.status(httpStatus.UNAUTHORIZED).json({ message: "Authentication required" });
    }

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.SERVICE_UNAVAILABLE).json({ message: "Database connection unavailable" });
        }
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }

        if (name && typeof name === "string") user.name = name.trim();
        if (email !== undefined && typeof email === "string") user.email = email.trim();
        if (avatar !== undefined && typeof avatar === "string") user.avatar = avatar;

        await user.save();

        return res.status(httpStatus.OK).json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                preferredLanguage: user.preferredLanguage || "en"
            }
        });
    } catch (e) {
        console.error("updateUserProfile error:", e);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to update profile" });
    }
};

// Protected: Only delete meetings belonging to req.user.username
const deleteUserHistory = async (req, res) => {
    const { meetingId, meetingCode } = req.body || {};

    if (!req.user || !req.user.username) {
        return res.status(httpStatus.UNAUTHORIZED).json({ message: "Authentication required" });
    }

    if (!meetingId && !meetingCode) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "meetingId or meetingCode required" });
    }

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.OK).json({ message: "History item deleted" });
        }

        // Strictly delete ONLY meetings owned by the authenticated user
        const deleteConditions = [];
        if (meetingId && mongoose.Types.ObjectId.isValid(meetingId)) {
            deleteConditions.push({ _id: meetingId, user_id: req.user.username });
        }
        if (meetingCode && typeof meetingCode === "string") {
            deleteConditions.push({ meetingCode: meetingCode.trim(), user_id: req.user.username });
        }

        if (deleteConditions.length > 0) {
            const result = await Meeting.deleteMany({ $or: deleteConditions });
            if (result.deletedCount === 0) {
                return res.status(httpStatus.FORBIDDEN).json({ message: "No meeting history found or permission denied" });
            }
        }

        return res.status(httpStatus.OK).json({ message: "Meeting history deleted successfully" });
    } catch (e) {
        console.error("Delete history error:", e);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to delete meeting history" });
    }
};

const forgotPassword = async (req, res) => {
    const rawIdentifier = req.body?.email || req.body?.username || req.body?.emailOrUsername;
    if (!rawIdentifier || typeof rawIdentifier !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Email or username is required" });
    }

    const identifier = rawIdentifier.trim().toLowerCase();
    const genericMessage = "If an account exists for this email, a password reset link has been sent.";

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.SERVICE_UNAVAILABLE).json({ message: "Database connection unavailable" });
        }

        const user = await User.findOne({
            $or: [
                { email: identifier },
                { username: identifier }
            ]
        });

        if (!user) {
            // Safe generic response to avoid account enumeration
            return res.status(httpStatus.OK).json({ message: genericMessage });
        }

        // Generate cryptographically secure token
        const resetToken = crypto.randomBytes(32).toString("hex");

        // Hash token for database storage (SHA-256)
        const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        await user.save();

        const frontendBase = getFrontendUrl(req);
        const resetUrl = `${frontendBase}/reset-password/${resetToken}`;

        const recipientEmail = user.email || (identifier.includes("@") ? identifier : "");
        await sendResetPasswordEmail({
            to: recipientEmail,
            username: user.name || user.username,
            resetUrl
        });

        return res.status(httpStatus.OK).json({ message: genericMessage });
    } catch (err) {
        console.error("forgotPassword controller error:", err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to process forgot password request" });
    }
};

const verifyResetToken = async (req, res) => {
    const { token } = req.params;
    if (!token || typeof token !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ valid: false, message: "Reset token is required" });
    }

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.SERVICE_UNAVAILABLE).json({ message: "Database connection unavailable" });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(httpStatus.BAD_REQUEST).json({ valid: false, message: "Password reset token is invalid or has expired" });
        }

        return res.status(httpStatus.OK).json({ valid: true, username: user.username });
    } catch (err) {
        console.error("verifyResetToken controller error:", err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Error verifying reset token" });
    }
};

const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body || {};

    if (!token || typeof token !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Reset token is required" });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Password must be at least 6 characters long" });
    }

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.SERVICE_UNAVAILABLE).json({ message: "Database connection unavailable" });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(httpStatus.BAD_REQUEST).json({ message: "Password reset token is invalid or has expired" });
        }

        // Hash new password using bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return res.status(httpStatus.OK).json({ message: "Password reset successfully. Please sign in." });
    } catch (err) {
        console.error("resetPassword controller error:", err);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Error resetting password" });
    }
};

export {
    login,
    register,
    getUserHistory,
    addToHistory,
    deleteUserHistory,
    updateLanguage,
    getUserProfile,
    createMeeting,
    getMeetingByCode,
    updateUserProfile,
    forgotPassword,
    verifyResetToken,
    resetPassword
};