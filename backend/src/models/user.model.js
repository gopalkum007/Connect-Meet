import mongoose, { Schema } from "mongoose";

const userScheme = new Schema(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, index: true, trim: true },
        password: { type: String, required: true },
        email: { type: String, default: "", trim: true },
        avatar: { type: String, default: "" },
        preferredLanguage: { type: String, default: "en" }
    },
    { timestamps: true }
);

const User = mongoose.model("User", userScheme);

export { User };