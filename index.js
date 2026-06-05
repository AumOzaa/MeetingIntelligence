import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { Meeting, ActionItem } from "./database.js";
import { MeetingIntelligenceSchema } from "./schemas/geminiOutput.js";
import { validate } from "./validation/middleware.js";
import {
    CreateMeetingRequestSchema,
    GetMeetingByIdRequestSchema,
    CreateActionItemRequestSchema,
    UpdateActionItemStatusSchema,
    GetActionItemsQuerySchema,
    ObjectIdSchema
} from "./validation/schemas.js";

dotenv.config();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const app = express();

app.use(express.json());

// Helper function to send standardized error response
const sendError = (res, code, message, traceId = randomUUID()) => {
    return res.status(400).json({
        traceId,
        success: false,
        error: {
            code,
            message
        }
    });
};

// Helper function to send standardized success response
const sendSuccess = (res, data, traceId = randomUUID()) => {
    return res.status(200).json({
        traceId,
        success: true,
        data
    });
};

// ==================== MEETING ROUTES ====================

// POST /api/meetings - Create a new meeting
app.post("/api/meetings", validate(CreateMeetingRequestSchema, "body"), async (req, res) => {
    try {
        const meetingPayload = req.body;

        const meeting = await Meeting.create({
            transcripts: meetingPayload
        });

        sendSuccess(res, meeting, req.traceId);
    } catch (error) {
        console.error(error);
        sendError(res, "INTERNAL_ERROR", "Failed to create meeting");
    }
});

// GET /api/meetings/:id - Get a meeting by ID
app.get("/api/meetings/:id", validate(GetMeetingByIdRequestSchema, "params"), async (req, res) => {
    try {
        const id = req.params.id;

        const meeting = await Meeting.findById(id);

        if (!meeting) {
            return sendError(res, "NOT_FOUND", "Meeting not found", req.traceId);
        }

        sendSuccess(res, { meeting }, req.traceId);
    } catch (error) {
        console.error(error);
        sendError(res, "INTERNAL_ERROR", "Failed to fetch meeting", req.traceId);
    }
});

// GET /api/meetings - Get all meetings (with pagination and filtering)
app.get("/api/meetings", async (req, res) => {
    try {
        const { limit = 10, page = 1, status, assignee } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (assignee) filter.assignee = assignee;

        const skip = (page - 1) * limit;

        const [meetings, total] = await Promise.all([
            Meeting.find(filter).limit(parseInt(limit)).skip(skip),
            Meeting.countDocuments(filter)
        ]);

        sendSuccess(res, {
            meetings,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        }, req.traceId);
    } catch (error) {
        console.error(error);
        sendError(res, "INTERNAL_ERROR", "Failed to fetch meetings", req.traceId);
    }
});

// GET /api/meetings/:id/analyze - Get meeting analysis
app.get("/api/meetings/:id/analyze", validate(GetMeetingByIdRequestSchema, "params"), async (req, res) => {
    try {
        const id = req.params.id;

        const meeting = await Meeting.findById(id);

        if (!meeting) {
            return sendError(res, "NOT_FOUND", "Meeting not found", req.traceId);
        }

        sendSuccess(res, { analysis: meeting.stuctured_output }, req.traceId);
    } catch (error) {
        console.error(error);
        sendError(res, "INTERNAL_ERROR", "Failed to fetch meeting analysis", req.traceId);
    }
});

// POST /api/meetings/:id/analyze - Analyze meeting with Gemini
app.post("/api/meetings/:id/analyze", validate(GetMeetingByIdRequestSchema, "params"), async (req, res) => {
    const id = req.params.id;

    const systemPrompt = `
  You are an expert project operations analyzer.

  Extract:
  - summaries
  - action items
  - decisions
  - follow up suggestions

  Every item MUST include timestamp citations from the transcript.
  Return JSON in EXACTLY this structure:

  {
    "summary": [
      {
        "text": "string",
        "citations": [
          {
            "timestamp": "00:10"
          }
        ]
      }
    ],
    "actionItems": [
      {
        "task": "string",
        "assignee": "string",
        "status": "Pending",
        "citations": [
          {
            "timestamp": "00:20"
          }
        ]
      }
    ],
    "decisions": [
      {
        "decision": "string",
        "citations": [
          {
            "timestamp": "00:35"
          }
        ]
      }
    ],
    "followUpSuggestions": [
      {
        "suggestion": "string",
        "citations": [
          {
            "timestamp": "00:35"
          }
        ]
      }
    ]
  }

  Do not use any other field names.
  `;

    try {
        const meeting = await Meeting.findById(id);

        if (!meeting) {
            return sendError(res, "NOT_FOUND", "Meeting not found", req.traceId);
        }

        const meetingPayload = meeting.transcripts;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: JSON.stringify(meetingPayload),
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                temperature: 0
            }
        });

        const rawJson = JSON.parse(response.text);
        const structuredOutput = MeetingIntelligenceSchema.parse(rawJson);

        const updatedMeeting = await Meeting.findByIdAndUpdate(
            id,
            { structured_output: structuredOutput },
            { new: true }
        );

        // Create action items, skipping duplicates
        const generatedActionItems = structuredOutput.actionItems || [];
        const createdCount = { new: 0, skipped: 0 };

        for (const actionItemData of generatedActionItems) {
            const existingActionItem = await ActionItem.findOne({
                meeting_id: id,
                task: actionItemData.task
            });

            if (existingActionItem) {
                createdCount.skipped++;
                continue;
            }

            await ActionItem.create({
                meeting_id: id,
                assignee: actionItemData.assignee,
                task: actionItemData.task,
                status: actionItemData.status || "Pending",
                created_at: new Date()
            });
            createdCount.new++;
        }

        sendSuccess(res, {
            structuredOutput,
            actionItems: {
                total: generatedActionItems.length,
                created: createdCount.new,
                skipped: createdCount.skipped
            }
        }, req.traceId);
    } catch (error) {
        console.error(error);
        if (error instanceof z.ZodError) {
            return sendError(res, "VALIDATION_ERROR", error.errors[0]?.message || "Validation failed", req.traceId);
        }
        sendError(res, "INTERNAL_ERROR", "Failed to analyze meeting", req.traceId);
    }
});

// ==================== ACTION ITEM ROUTES ====================

// POST /api/action-items - Create a new action item
app.post("/api/action-items", validate(CreateActionItemRequestSchema, "body"), async (req, res) => {
    try {
        const actionItemData = req.body;

        const actionItem = await ActionItem.create({
            meeting_id: actionItemData.meeting_id,
            assignee: actionItemData.assignee,
            task: actionItemData.task,
            status: actionItemData.status
        });

        sendSuccess(res, { actionItem }, req.traceId);
    } catch (error) {
        console.error(error);
        sendError(res, "INTERNAL_ERROR", "Failed to create action item", req.traceId);
    }
});

// GET /api/action-items - Get action items with filtering
app.get("/api/action-items", validate(GetActionItemsQuerySchema, "query"), async (req, res) => {
    try {
        const { status, assignee, meetingId } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (assignee) filter.assignee = assignee;
        if (meetingId) filter.meetingId = meetingId;

        const actionItems = await ActionItem.find(filter);

        sendSuccess(res, actionItems, req.traceId);
    } catch (error) {
        console.error(error);
        sendError(res, "INTERNAL_ERROR", "Failed to fetch action items", req.traceId);
    }
});

// PATCH /api/action-items/:id/status - Update action item status
app.patch("/api/action-items/:id/status", validate(UpdateActionItemStatusSchema, "all"), async (req, res) => {
    try {
        const { id } = req.params;
        const { status, due_date, dueDate } = req.body;

        const updateFields = {};
        if (status !== undefined) {
            updateFields.status = status;
        }
        // Support both dueDate (camelCase) and due_date (snake_case) from client
        if (dueDate !== undefined) {
            updateFields.due_date = dueDate;
        } else if (due_date !== undefined) {
            updateFields.due_date = due_date;
        }

        const actionItem = await ActionItem.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true }
        );

        if (!actionItem) {
            return sendError(res, "NOT_FOUND", "Action item not found", req.traceId);
        }

        sendSuccess(res, actionItem, req.traceId);
    } catch (error) {
        console.error(error);
        sendError(res, "INTERNAL_ERROR", "Failed to update action item", req.traceId);
    }
});

// GET /api/action-items/overdue - Get overdue action items
app.get("/api/action-items/overdue", async (req, res) => {
    try {
        const overdueActionItems = await ActionItem.find({
            status: {
                $ne: "COMPLETED"
            },
            dueDate: {
                $lt: new Date()
            }
        });

        sendSuccess(res, {
            count: overdueActionItems.length,
            data: overdueActionItems
        }, req.traceId);
    } catch (error) {
        console.error(error);
        sendError(res, "INTERNAL_ERROR", "Failed to fetch overdue action items", req.traceId);
    }
});

// Start server
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
