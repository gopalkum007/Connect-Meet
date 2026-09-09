import mongoose, { Schema } from "mongoose";

const meetingSettingsSchema = new Schema(
    {
        meetingId: { type: String, required: true, unique: true, index: true },
        hostId: { type: String, required: true, index: true },
        chatPermission: { type: String, enum: ["Everyone", "Private", "Disabled"], default: "Everyone" },
        allowPrivateMessages: { type: Boolean, default: true },
        allowScreenShare: { type: Boolean, default: true }
    },
    { timestamps: true }
);

const MeetingSettings = mongoose.model("MeetingSettings", meetingSettingsSchema);

export { MeetingSettings };
