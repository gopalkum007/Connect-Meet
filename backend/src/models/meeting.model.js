import mongoose, { Schema } from "mongoose";

const meetingSchema = new Schema(
    {
        user_id: { type: String, index: true },
        meetingCode: { type: String, required: true, index: true },
        title: { type: String, default: "ConnectMeet Meeting", trim: true },
        description: { type: String, default: "", trim: true },
        scheduledStartTime: { type: Date },
        scheduledEndTime: { type: Date },
        status: { type: String, enum: ["Scheduled", "Live", "Ended", "Cancelled"], default: "Live" },
        chatPermission: { type: String, enum: ["Everyone", "Private", "Disabled"], default: "Everyone" },
        date: { type: Date, default: Date.now, required: true }
    },
    { timestamps: true }
);

meetingSchema.index({ user_id: 1, date: -1 });

const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };