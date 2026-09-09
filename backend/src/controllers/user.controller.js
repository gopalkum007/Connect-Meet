import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Meeting } from "../models/meeting.model.js";

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
    const { name, username, password } = req.body || {};

    if (!name || !username || !password || 
        typeof name !== "string" || typeof username !== "string" || typeof password !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Name, username, and password are required" });
    }

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();

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
            password: hashedPassword
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

        const existingMeeting = await Meeting.findOne({ meetingCode: cleanCode });
        if (existingMeeting) {
            return res.status(httpStatus.OK).json({ message: "Meeting already exists in database", meeting: existingMeeting });
        }

        const newMeeting = new Meeting({
            user_id: req.user.username,
            meetingCode: cleanCode,
            title: "Instant Meeting",
            status: "Live",
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
    const { meetingCode, title, description, scheduledStartTime, scheduledEndTime, status, chatPermission } = req.body || {};

    if (!meetingCode || typeof meetingCode !== "string") {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Valid meeting code is required" });
    }

    const cleanCode = meetingCode.trim();
    const creatorUsername = req.user ? req.user.username : "Guest";

    try {
        if (!isDbConnected()) {
            return res.status(httpStatus.CREATED).json({
                message: "Meeting created in room session",
                meeting: { meetingCode: cleanCode, title: title || "ConnectMeet Meeting", status: status || "Live", chatPermission: chatPermission || "Everyone" }
            });
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
            return res.status(httpStatus.OK).json({ message: "Meeting updated successfully", meeting: existingMeeting });
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
        return res.status(httpStatus.CREATED).json({ message: "Meeting created successfully", meeting: newMeeting });
    } catch (e) {
        console.error("createMeeting error:", e);
        return res.status(httpStatus.CREATED).json({
            message: "Meeting room active",
            meeting: { meetingCode: cleanCode, title: title || "ConnectMeet Meeting", status: status || "Live" }
        });
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
    updateUserProfile
};