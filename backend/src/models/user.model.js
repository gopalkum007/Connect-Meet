import mongoose, { Schema } from "mongoose";

const userScheme = new Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, index: true, trim: true },
        password: { type: String, required: true },
        email: { type: String, default: "", trim: true },
        avatar: { type: String, default: "" },
        preferredLanguage: { type: String, default: "en" },
        resetPasswordToken: { type: String, default: null, index: true },
        resetPasswordExpires: { type: Date, default: null }
    },
    { timestamps: true }
);

const User = mongoose.model("User", userScheme);

export { User };