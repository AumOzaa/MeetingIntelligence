import mongoose, { mongo } from "mongoose";
import express from "express";
import dotenv from "dotenv";
import { MeetingIntelligenceSchema } from "./schemas/geminiOutput.js";
import { Meeting, ActionItem } from "./database.js";
import { success } from "zod";

dotenv.config();

import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const app = express();

app.use(express.json());

app.post("/api/meetings", async (req, res) => {
    // Need to ingest the transcripts, and create the meeting ID + structured output for that + when it was created + zod at the end.

    // TODO: Validation required with ZOD.
    try {
        const data = req.body;
        console.log(data);
        const meetingPayload = data.meetingPayload;
        console.log(meetingPayload);
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

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: JSON.stringify(meetingPayload),
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                temperature: 0
            }
        });
        console.log(response.text);
        const rawJson = JSON.parse(response.text);
        const structuredOutput =
            MeetingIntelligenceSchema.parse(rawJson);

        console.log(structuredOutput.summary);
        console.log(structuredOutput.actionItems);

        const meeting = await Meeting.create({
            transcripts: meetingPayload,
            stuctured_output: structuredOutput
        });

        res.status(200).json({
            success: true,
            data: structuredOutput
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get("/api/meetings/:id", async (req, res) => {
    // TODO: Add validations
    const id = req.params.id;

    const all_meetings = await Meeting.findById(id);

    res.status(200).json({
        all_meetings
    });
});

app.get("/api/meetings/", async (req, res) => {
    // TODO: Adding validations, pagination and filtering support.
    const all_meetings = await Meeting.find({});

    res.status(200).json({
        all_meetings
    });
});

app.get("/api/meetings/:id/analyze", async (req, res) => {
    // TODO: Adding validations.
    const id = req.params.id;

    const meeting_analysis = await Meeting.findById({ id });
    res.status(200).json({
        meeting_analysis
    });
});

app.post("/api/meetings/:id/analyze", async (req, res) => {
    const id = req.params.id;
    // TODO: Move the LLM logic here.
    //
    res.status(200).json({
        "msg": "Dummy call left todo"
    });
});


// ACTIONABLE ITEMS :
app.post("/api/action-items", async (req, res) => {
    // ASSUMING THAT THIS IS FOR CREATING A TASK MANUALLY. 
    // In this what is required is: meeting id and other details mentioned in schema.
    const user_body = req.body;
    // TODO: Custom time
    const create_action_item = await ActionItem.create({
        meeting_id: user_body.meeting_id,
        assignee: user_body.assignee,
        task: user_body.task,
        status: user_body.status
    });

    res.status(200).json({
        "msg": "Sucessfully created the action item"
    });

});

app.get("/api/action-items", async (req, res) => {
    const { status, assignee, meetingId } = req.query;

    const filter = {};

    if (status) {
        filter.status = status;
    }

    if (assignee) {
        filter.assignee = assignee;
    }

    if (meetingId) {
        filter.meetingId = meetingId;
    }

    const actionItems = await ActionItem.find(filter);

    res.status(200).json(actionItems);
});

app.patch("/api/action-items/:id/status", async (req, res) => {
    try {
        const { id } = req.params;

        // TODO: KARDENA BHAI VALIDATE
        const validatedData = req.body;

        const actionItem =
            await ActionItem.findByIdAndUpdate(
                id,
                {
                    status: validatedData.status
                },
                {
                    new: true
                }
            );

        if (!actionItem) {
            return res.status(404).json({
                success: false,
                message: "Action item not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: actionItem
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

app.get("/api/action-items/overdue", async (req, res) => {
    //TODO: RN user needs to do this manually
    try {
        const overdueActionItems = await ActionItem.find({
            status: {
                $ne: "COMPLETED"
            },
            dueDate: {
                $lt: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            count: overdueActionItems.length,
            data: overdueActionItems
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(3000, () => {
    console.log("http://localhost:3000");
});
