import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

const userSchema = new mongoose.Schema({
    userName: String,
    email: String,
    passwordHash: String
});

const meetingSchema = new mongoose.Schema({
    transcripts: Object,
    structured_output: Object,
    created_at: { type: Date, default: Date.now() }
});

const actionItemsSchema = new mongoose.Schema({
    meeting_id: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Meeting',
        required: true
    }],
    assignee: String,
    task: String,
    status: String,
    created_at: { type: Date, default: Date.now() },
    due_date: { type: Date, default: null },
    dueDate: { type: Date, default: null }
});

// Export models
export const Meeting = new mongoose.model("Meeting", meetingSchema);
export const ActionItem = new mongoose.model("ActionItem", actionItemsSchema);

// Only connect if not in test mode
if (process.env.NODE_ENV !== 'test' && !mongoose.connection.client) {
    console.log("Connecting to MongoDB...");
    mongoose.connect(process.env.MONGO_URI);
}
