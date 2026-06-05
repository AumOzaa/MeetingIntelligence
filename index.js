import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import cron from "node-cron";
import { randomUUID } from "crypto";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { Meeting, ActionItem, User } from "./database.js";
import { MeetingIntelligenceSchema } from "./schemas/geminiOutput.js";
import { validate, authenticate } from "./validation/middleware.js";
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import TelegramBot from "node-telegram-bot-api";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import logger from "./utils/logger.js";
import {
    CreateMeetingRequestSchema,
    GetMeetingByIdRequestSchema,
    CreateActionItemRequestSchema,
    UpdateActionItemStatusSchema,
    GetActionItemsQuerySchema,
    RegisterSchema,
    LoginSchema,
    ObjectIdSchema
} from "./validation/schemas.js";

dotenv.config();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: false
});
export { ai };

const app = express();

app.use(express.json());

// ==================== LOGGING MIDDLEWARE ====================
// Logs request details including traceId, method, path, status
app.use((req, res, next) => {
    const traceId = randomUUID();
    req.traceId = traceId;

    const userAgent = req.get('user-agent') || '';
    const requestInfo = {
        traceId,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        userAgent
    };

    logger.info(`Request received - ${req.method} ${req.path}`, { ...requestInfo });

    // Log response when it's sent
    res.on('finish', () => {
        const responseInfo = {
            traceId,
            timestamp: new Date().toISOString(),
            statusCode: res.statusCode,
            status: res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'error',
            method: req.method,
            path: req.path
        };

        if (res.statusCode >= 500) {
            logger.error(`Response sent - ${req.method} ${req.path} - ${res.statusCode}`, responseInfo);
        } else if (res.statusCode >= 400) {
            logger.warn(`Response sent - ${req.method} ${req.path} - ${res.statusCode}`, responseInfo);
        } else {
            logger.info(`Response sent - ${req.method} ${req.path} - ${res.statusCode}`, responseInfo);
        }
    });

    next();
});

// Error handling middleware with logging
app.use((err, req, res, next) => {
    const traceId = req.traceId || randomUUID();

    logger.error({
        message: err.message,
        stack: err.stack,
        traceId,
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
    });

    res.status(err.statusCode || 500).json({
        traceId,
        success: false,
        error: {
            code: err.statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
        }
    });
});

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Meeting Intelligence API",
            version: "2.0.0",
            description: "API for meeting transcription, AI analysis, and action item tracking",
        },
        servers: [
            {
                url: "http://localhost:3000",
            },
        ],
    },
    apis: ["./index.js"],
});

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

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
/**
 * @swagger
 * /api/meetings:
 *   POST:
 *     summary: Create meeting and add transcripts.
 *     responses:
 *       200:
 *         description: Success
 */
app.post("/api/meetings", authenticate, validate(CreateMeetingRequestSchema, "body"), async (req, res) => {
    try {
        const meetingPayload = req.body;

        const meeting = await Meeting.create({
            transcripts: meetingPayload
        });

        logger.info(`Meeting created successfully`, {
            traceId: req.traceId,
            meetingId: meeting._id,
            participants: meetingPayload.participants.length
        });

        res.status(201).json({
            traceId: req.traceId,
            success: true,
            data: meeting
        });
    } catch (error) {
        logger.error({
            message: "Failed to create meeting",
            error: error.message,
            stack: error.stack,
            traceId: req.traceId
        });
        sendError(res, "INTERNAL_ERROR", "Failed to create meeting");
    }
});

// GET /api/meetings/:id - Get a meeting by ID
/**
 * @swagger
 * /api/meetings/:id:
 *   get:
 *     summary: Getting meetings with id.
 *     responses:
 *       200:
 *         description: Success
 */
app.get("/api/meetings/:id", authenticate, validate(GetMeetingByIdRequestSchema, "params"), async (req, res) => {
    try {
        const id = req.params.id;

        const meeting = await Meeting.findById(id);

        if (!meeting) {
            logger.warn(`Meeting not found - ID: ${id}`, { traceId: req.traceId });
            return sendError(res, "NOT_FOUND", "Meeting not found", req.traceId);
        }

        sendSuccess(res, { meeting }, req.traceId);
    } catch (error) {
        logger.error({
            message: "Failed to fetch meeting",
            error: error.message,
            traceId: req.traceId
        });
        sendError(res, "INTERNAL_ERROR", "Failed to fetch meeting", req.traceId);
    }
});

// GET /api/meetings - Get all meetings (with pagination and filtering)
/**
 * @swagger
 * /api/meetings:
 *   get:
 *     summary: Getting meetings.
 *     responses:
 *       200:
 *         description: Success
 */
app.get("/api/meetings", authenticate, async (req, res) => {
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
        logger.error({
            message: "Failed to fetch meetings",
            error: error.message,
            traceId: req.traceId
        });
        sendError(res, "INTERNAL_ERROR", "Failed to fetch meetings", req.traceId);
    }
});

// GET /api/meetings/:id/analyze - Get meeting analysis
/**
 * @swagger
 * /api/meetings/:id/analyze:
 *   get:
 *     summary: Getting meetings summary with id.
 *     responses:
 *       200:
 *         description: Success
 */
app.get("/api/meetings/:id/analyze", authenticate, validate(GetMeetingByIdRequestSchema, "params"), async (req, res) => {
    try {
        const id = req.params.id;

        const meeting = await Meeting.findById(id);

        if (!meeting) {
            logger.warn(`Meeting not found - ID: ${id}`, { traceId: req.traceId });
            return sendError(res, "NOT_FOUND", "Meeting not found", req.traceId);
        }

        sendSuccess(res, { analysis: meeting.structured_output }, req.traceId);
    } catch (error) {
        logger.error({
            message: "Failed to fetch meeting analysis",
            error: error.message,
            traceId: req.traceId
        });
        sendError(res, "INTERNAL_ERROR", "Failed to fetch meeting analysis", req.traceId);
    }
});

// POST /api/meetings/:id/analyze - Analyze meeting with Gemini
/**
 * @swagger
 * /api/meetings:
 *   post:
 *     summary: Generate AI analysis of a meeting id.
 *     responses:
 *       200:
 *         description: Success
 */
app.post("/api/meetings/:id/analyze", authenticate, validate(GetMeetingByIdRequestSchema, "params"), async (req, res) => {
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
            logger.warn(`Meeting not found - ID: ${id}`, { traceId: req.traceId });
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

        logger.info(`Meeting analysis completed`, {
            traceId: req.traceId,
            meetingId: id,
            actionItemsCreated: createdCount.new,
            actionItemsSkipped: createdCount.skipped
        });

        sendSuccess(res, {
            structuredOutput,
            actionItems: {
                total: generatedActionItems.length,
                created: createdCount.new,
                skipped: createdCount.skipped
            }
        }, req.traceId);
    } catch (error) {
        logger.error({
            message: "Failed to analyze meeting",
            error: error.message,
            stack: error.stack,
            traceId: req.traceId
        });
        if (error instanceof z.ZodError) {
            return sendError(res, "VALIDATION_ERROR", error.errors[0]?.message || "Validation failed", req.traceId);
        }
        sendError(res, "INTERNAL_ERROR", "Failed to analyze meeting", req.traceId);
    }
});

// ==================== ACTION ITEM ROUTES ====================

// POST /api/action-items - Create a new action item
/**
 * @swagger
 * /api/action-items:
 *   post:
 *     summary: Create action item
 *     responses:
 *       200:
 *         description: Success
 */
app.post("/api/action-items", authenticate, validate(CreateActionItemRequestSchema, "body"), async (req, res) => {
    try {
        const actionItemData = req.body;

        const actionItem = await ActionItem.create({
            meeting_id: actionItemData.meeting_id,
            assignee: actionItemData.assignee,
            task: actionItemData.task,
            status: actionItemData.status
        });

        logger.info(`Action item created`, {
            traceId: req.traceId,
            actionItemId: actionItem._id,
            assignee: actionItemData.assignee,
            meetingId: actionItemData.meeting_id
        });

        sendSuccess(res, { actionItem }, req.traceId);
    } catch (error) {
        logger.error({
            message: "Failed to create action item",
            error: error.message,
            traceId: req.traceId
        });
        sendError(res, "INTERNAL_ERROR", "Failed to create action item", req.traceId);
    }
});

// GET /api/action-items - Get action items with filtering
/**
 * @swagger
 * /api/meetings:
 *   get:
 *     summary: Get action items
 *     responses:
 *       200:
 *         description: Success
 */
app.get("/api/action-items", authenticate, validate(GetActionItemsQuerySchema, "query"), async (req, res) => {
    try {
        const { status, assignee, meetingId } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (assignee) filter.assignee = assignee;
        if (meetingId) filter.meetingId = meetingId;

        const actionItems = await ActionItem.find(filter);

        sendSuccess(res, actionItems, req.traceId);
    } catch (error) {
        logger.error({
            message: "Failed to fetch action items",
            error: error.message,
            traceId: req.traceId
        });
        sendError(res, "INTERNAL_ERROR", "Failed to fetch action items", req.traceId);
    }
});

// PATCH /api/action-items/:id/status - Update action item status
/**
 * @swagger
 * /api/action-items/:id/status:
 *   patch:
 *     summary: Update the due date and status
 *     responses:
 *       200:
 *         description: Success
 */
app.patch("/api/action-items/:id/status", authenticate, validate(UpdateActionItemStatusSchema, "all"), async (req, res) => {
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
            logger.warn(`Action item not found - ID: ${id}`, { traceId: req.traceId });
            return sendError(res, "NOT_FOUND", "Action item not found", req.traceId);
        }

        logger.info(`Action item updated`, {
            traceId: req.traceId,
            actionItemId: id,
            updateFields
        });

        sendSuccess(res, actionItem, req.traceId);
    } catch (error) {
        logger.error({
            message: "Failed to update action item",
            error: error.message,
            traceId: req.traceId
        });
        sendError(res, "INTERNAL_ERROR", "Failed to update action item", req.traceId);
    }
});

// GET /api/action-items/overdue - Get overdue action items
/**
 * @swagger
 * /api/meetings:
 *   get:
 *     summary: Get overdue items and filtering.
 *     responses:
 *       200:
 *         description: Success
 */
app.get("/api/action-items/overdue", authenticate, async (req, res) => {
    try {
        const dueItems = await ActionItem.find({
            status: { $ne: "Completed" },
            due_date: {
                $ne: null,
                $lt: new Date()
            },
            reminder_sent: { $ne: true }
        });

        logger.info(`Overdue items retrieved`, {
            traceId: req.traceId,
            count: dueItems.length
        });

        sendSuccess(res, {
            count: dueItems.length,
            data: dueItems
        }, req.traceId);
    } catch (error) {
        logger.error({
            message: "Failed to fetch overdue action items",
            error: error.message,
            traceId: req.traceId
        });
        sendError(res, "INTERNAL_ERROR", "Failed to fetch overdue action items", req.traceId);
    }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: New user registration.
 *     responses:
 *       200:
 *         description: Success
 */
app.post("/api/auth/register", async (req, res) => {
    try {

        const validatedData =
            RegisterSchema.parse(req.body);

        const existingUser =
            await User.findOne({
                email: validatedData.email
            });

        if (existingUser) {
            logger.warn(`Registration attempt - User already exists - Email: ${validatedData.email}`, { traceId: req.traceId });
            return res.status(409).json({
                success: false,
                message: "User already exists"
            });
        }

        const hashedPassword =
            await bcrypt.hash(
                validatedData.password,
                10
            );

        const user = await User.create({
            email: validatedData.email,
            password: hashedPassword
        });

        logger.info(`User registered`, {
            traceId: req.traceId,
            userId: user._id,
            email: validatedData.email
        });

        return res.status(201).json({
            success: true,
            data: {
                id: user._id,
                email: user.email
            }
        });

    } catch (error) {
        logger.error({
            message: "Registration failed",
            error: error.message,
            traceId: req.traceId
        });

        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     responses:
 *       200:
 *         description: Success
 */
app.post("/api/auth/login", async (req, res) => {
    try {

        const validatedData =
            LoginSchema.parse(req.body);

        const user =
            await User.findOne({
                email: validatedData.email
            });

        if (!user) {
            logger.warn(`Login attempt - Invalid credentials - Email: ${validatedData.email}`, { traceId: req.traceId });
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const passwordMatches =
            await bcrypt.compare(
                validatedData.password,
                user.password
            );

        if (!passwordMatches) {
            logger.warn(`Login attempt - Invalid credentials - Email: ${validatedData.email}`, { traceId: req.traceId });
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = jwt.sign(
            {
                userId: user._id,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        logger.info(`User logged in`, {
            traceId: req.traceId,
            userId: user._id,
            email: validatedData.email
        });

        return res.status(200).json({
            success: true,
            token
        });

    } catch (error) {

        logger.error({
            message: "Login failed",
            error: error.message,
            traceId: req.traceId
        });

        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * @swagger
 * /api/evaluation:
 *   get:
 *     summary: About me :)
 *     responses:
 *       200:
 *         description: Success
 */
app.get("/api/evaluation", (req, res) => {
    const response =
    {
        "candidateName": "Aum Oza",
        "email": "aumoza404@gmail.com",
        "repositoryUrl": "https://github.com/AumOzaa/MeetingIntelligence.git", "deployedUrl": "http://54.252.181.209:3000/api-docs/",
        "externalIntegration": "Telegram Bot API",
        "features": [
            "Authentication",
            "AI Analysis",
            "Reminder Scheduler"
        ]
    }

    res.status(200).send(response);
});

// await mongoose.connect(process.env.MONGO_URI);

cron.schedule("* * * * *", async () => {
    logger.info("Running reminder job");
    try {
        await processReminders();
    } catch (error) {
        logger.error({
            message: "Reminder job failed",
            error: error.message,
            stack: error.stack
        });
    }
});

app.get("/telegram-test", async (req, res) => {
    await bot.sendMessage(
        process.env.TELEGRAM_CHAT_ID,
        "🚀 Telegram integration working!"
    );
    res.json({
        success: true
    });
});

async function processReminders() {
    const dueItems = await ActionItem.find({
        status: {
            $ne: "Completed"
        },
        due_date: {
            $ne: null,
            $lt: new Date()
        },
        reminder_sent: {
            $ne: true
        }
    });

    for (const item of dueItems) {
        const message = `
🔔 Reminder

Task: ${item.task}
Assigned To: ${item.assignee}
Due Date: ${item.due_date.toISOString().split("T")[0]}
`;

        await bot.sendMessage(
            process.env.TELEGRAM_CHAT_ID,
            message
        );

        item.reminder_sent = true;
        await item.save();
    }

    logger.info(`Reminder job completed`, {
        remindersSent: dueItems.length
    });
}

app.listen(3000, "0.0.0.0", () => {
    logger.info("Server started on http://localhost:3000");
});

export default app;
