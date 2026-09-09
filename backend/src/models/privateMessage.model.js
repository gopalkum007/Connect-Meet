import mongoose, { Schema } from "mongoose";

const privateMessageSchema = new Schema(
    {
        senderId: { type: String, required: true },
        receiverId: { type: String, required: true },
        meetingId: { type: String, required: true, index: true },
        message: { type: String, required: true },
        translatedMessage: { type: String },
        language: { type: String, default: "en" },
        isRead: { type: Boolean, default: false }
    },
    { timestamps: true }
);

privateMessageSchema.index({ meetingId: 1, createdAt: -1 });

const PrivateMessage = mongoose.model("PrivateMessage", privateMessageSchema);

export { PrivateMessage };
