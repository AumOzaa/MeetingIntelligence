import { z } from "zod";

// Meeting schemas
export const TranscriptSchema = z.object({
  timestamp: z.string().regex(/^\d{2,3}:\d{2}$/),
  speaker: z.string().min(1),
  text: z.string().min(1)
});

export const CreateMeetingRequestSchema = z.object({
  title: z.string().min(1, "Meeting title is required"),
  participants: z.array(z.string().email("Invalid email format")).min(1, "At least one participant is required"),
  meetingDate: z.string().refine(
    (date) => !isNaN(Date.parse(date)),
    { message: "Invalid date format. Use ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)" }
  ),
  transcript: z.array(TranscriptSchema).min(1, "At least one transcript entry is required")
});

// ID validation schemas
export const ObjectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId format");

export const GetMeetingByIdRequestSchema = z.object({
  id: ObjectIdSchema
});

// Action Item schemas
export const CreateActionItemRequestSchema = z.object({
  meeting_id: ObjectIdSchema,
  assignee: z.string().min(1, "Assignee is required"),
  task: z.string().min(1, "Task description is required"),
  status: z.string().min(1, "Status is required")
});

export const UpdateActionItemStatusSchema = z.object({
  id: ObjectIdSchema,
  status: z.string().min(1, "Status is required"),
  due_date: z.string().optional().or(z.null()),
  dueDate: z.string().optional().or(z.null())
});

// Query parameter schemas
export const GetActionItemsQuerySchema = z.object({
  status: z.string().optional(),
  assignee: z.string().optional(),
  meetingId: z.string().optional()
});
