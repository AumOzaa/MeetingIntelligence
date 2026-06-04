import { z } from "zod";

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
    status: z.enum([
        "Pending",
        "In-Progress",
        "Completed"
    ]),
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
    followUpSuggestions: z.array(
        FollowUpSuggestionSchema
    )
});
