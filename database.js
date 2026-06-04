import mongoose, { mongo } from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

console.log("Connecting to MongoDB...");
mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
    userName: String,
    email: String,
    passwordHash: String
});

const meetingSchema = new mongoose.Schema({
    transcripts: Object,
    stuctured_output: Object,
    created_at: { type: Date, default: Date.now() }
});

const actionItemsSchema = new mongoose.Schema({
    meeting_id: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'meetingSchema',
        require: true
    }],

    assignee: String,
    task: String,
    status: String,
    created_at: { type: Date, default: Date.now() },
    due_date: { type: Date, default: null }
});

export const Meeting = new mongoose.model("Meeting", meetingSchema)
export const ActionItem = new mongoose.model("ActionItem", actionItemsSchema)
