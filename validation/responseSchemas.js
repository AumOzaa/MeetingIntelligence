import { z } from "zod";

// Re-use schemas from validation/schemas.js
export const TranscriptSchema = z.object({
  timestamp: z.string().regex(/^\d{2,3}:\d{2}$/),
  speaker: z.string().min(1),
  text: z.string().min(1)
});

export const CitationSchema = z.object({
  timestamp: z.string().regex(/^\d{2,3}:\d{2}$/)
});

export const SummaryItemSchema = z.object({
  text: z.string(),
  citations: z.array(CitationSchema).min(1)
});

export const ActionItemSchema = z.object({
  task: z.string(),
  assignee: z.string(),
  status: z.enum(["Pending", "In-Progress", "Completed"]),
  citations: z.array(CitationSchema).min(1)
});

export const DecisionItemSchema = z.object({
  decision: z.string(),
  citations: z.array(CitationSchema).min(1)
});

export const FollowUpSuggestionSchema = z.object({
  suggestion: z.string(),
  citations: z.array(CitationSchema).min(1)
});

export const MeetingIntelligenceSchema = z.object({
  summary: z.array(SummaryItemSchema),
  actionItems: z.array(ActionItemSchema),
  decisions: z.array(DecisionItemSchema),
  followUpSuggestions: z.array(FollowUpSuggestionSchema)
});

// Response schemas
export const MeetingResponseSchema = z.object({
  _id: z.string(),
  transcripts: z.any(),
  stuctured_output: z.any().optional(),
  created_at: z.string().optional()
});

export const ActionItemResponseSchema = z.object({
  _id: z.string(),
  meeting_id: z.string(),
  assignee: z.string(),
  task: z.string(),
  status: z.string(),
  created_at: z.string().optional(),
  due_date: z.string().optional().or(z.null())
});
