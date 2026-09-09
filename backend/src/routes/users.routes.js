import { Router } from "express";
import {
    addToHistory,
    getUserHistory,
    deleteUserHistory,
    login,
    register,
    updateLanguage,
    getUserProfile,
    createMeeting,
    getMeetingByCode,
    updateUserProfile
} from "../controllers/user.controller.js";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.route("/login").post(login);
router.route("/register").post(register);
router.route("/meeting/:code").get(getMeetingByCode);

// Protected routes (require valid JWT)
router.route("/get_profile").get(authMiddleware, getUserProfile);
router.route("/update_profile").post(authMiddleware, updateUserProfile);
router.route("/update_language").post(authMiddleware, updateLanguage);
router.route("/get_all_activity").get(authMiddleware, getUserHistory);
router.route("/add_to_activity").post(authMiddleware, addToHistory);
router.route("/delete_history").post(authMiddleware, deleteUserHistory);

// Optional auth route (associates user if JWT is provided, works for guests if not)
router.route("/create_meeting").post(optionalAuthMiddleware, createMeeting);

export default router;