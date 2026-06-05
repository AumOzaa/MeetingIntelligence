# AI Analysis Approach

This document explains how the Gemini AI integration works, from prompt design to output validation.

---

## Prompt Design

### System Prompt
```
You are an expert project operations analyzer.

Extract:
- summaries
- action items
- decisions
- follow up suggestions

Every item MUST include timestamp citations from the transcript.
Return JSON in EXACTLY this structure...

Do not use any other field names.
```

### Key Design Principles

1. **Role Assignment** - "Expert project operations analyzer" sets context for the model

2. **Explicit Extraction Requirements** - Four specific categories requested:
   - `summary` - Key points from the meeting
   - `actionItems` - Tasks assigned to participants
   - `decisions` - Formal decisions made
   - `followUpSuggestions` - Recommendations for next steps

3. **Citation Mandate** - "MUST include timestamp citations" prevents hallucination by requiring source references

4. **JSON Schema Specification** - Exact structure provided in prompt prevents format variations

5. **Temperature = 0** - Deterministic output ensures consistent analysis for same inputs

---

## Citation Strategy

### Why Citations
Citations link AI analysis back to specific moments in the transcript:
- Audit trail for verification
- Users can jump to relevant meeting moments
- Confidence in accuracy

### Format
```json
{
  "actionItems": [{
    "task": "Prepare release notes",
    "assignee": "Alice",
    "citations": [{"timestamp": "00:20"}]
  }]
}
```

### Timestamp Format
- Expected: `MM:SS` or `HH:MM` (e.g., "00:10", "01:30")
- Regex validation: `/^\d{2,3}:\d{2}$/`
- Stored as strings (not parsed) to preserve original format

### Implementation
1. Gemini returns JSON with embedded citations
2. Zod schema validates citation format
3. Invalid timestamps cause validation failure

---

## Hallucination Prevention

### Multi-Layer Approach

1. **Request Validation**
   ```javascript
   CreateMeetingRequestSchema = z.object({
     transcript: z.array(TranscriptSchema).min(1)
   })
   ```
   - Ensures valid input before processing

2. **Schema Validation**
   ```javascript
   ActionItemSchema = z.object({
     task: z.string(),
     assignee: z.string(),
     status: z.enum(["Pending", "In-Progress", "Completed"]),
     citations: z.array(CitationSchema).min(1)
   })
   ```
   - Rejects invalid output structures
   - Enforces minimum citations

3. **Zero Temperature**
   ```javascript
   temperature: 0
   ```
   - Deterministic, repeatable outputs

4. **Explicit Schema in Prompt**
   - Model knows exact expected format
   - "Do not use any other field names"

5. **Validation Errors**
   - Failed validation returns error instead of proceeding
   - User sees specific validation message

### Known Vulnerabilities
- Model could hallucinate valid-looking but fake data
- Long transcripts may cause context truncation
- No fact-checking against transcript content

---

## Output Validation Strategy

### Two-Tier Validation

1. **Request Validation (Client → Server)**
   - Zod schemas validate incoming requests
   - Returns 400 with detailed error messages
   - Fields validated: title, participants, meetingDate, transcript

2. **Response Validation (Server → Database)**
   - Gemini output parsed and validated
   - `MeetingIntelligenceSchema` enforces structure
   - Only valid outputs stored in database

3. **Database Schema**
   - Mongoose schema enforces basic structure
   - Indexes on frequently queried fields
   - Validation at storage level

### Validation Flow
```
Request → Zod Validate → API Handler → Gemini → Zod Validate → Database
                              ↓
                         Error Response (400)
```

---

## Known Limitations

1. **Citation Timestamp Format**
   - Assumes MM:SS format
   - Does not validate against actual transcript timestamps
   - Can cite timestamps not in transcript

2. **No Retry Logic**
   - If Gemini fails, analysis is lost
   - No exponential backoff or retry mechanism
   - Could add retry with circuit breaker

3. **Action Item Deduplication**
   - Based only on task text
   - Different assignments to same task not detected
   - `Task A - Alice` and `Task A - Bob` considered duplicate

4. **No Meeting Duration Validation**
   - Any transcript length accepted
   - Very long transcripts may hit token limits
   - No chunking for large inputs

5. **Single Language**
   - Prompt is English-only
   - Non-English transcripts need translation
   - No language detection

6. **Reminder Timing**
   - Cron runs once per minute
   - Lead times <1 minute may be missed
   - Not real-time

7. **No User Feedback Loop**
   - Users cannot correct AI extractions
   - No retraining based on corrections
   - No "mark as wrong" mechanism

8. **Context Limits**
   - Gemini Flash context window (~32k tokens)
   - Very long transcripts truncated
   - No chunking or summarization

---

## Future Improvements

1. **Retry with Backoff**
   ```javascript
   // Add retry logic for transient failures
   const maxRetries = 3;
   for (let i = 0; i < maxRetries; i++) {
     try {
       response = await ai.models.generateContent(...);
       break;
     } catch (e) {
       if (i === maxRetries - 1) throw e;
       await delay(Math.pow(2, i) * 1000);
     }
   }
   ```

2. **Better Citation Validation**
   - Compare citations against actual transcript timestamps
   - Warn if citations don't match

3. **Enhanced Deduplication**
   - Use semantic similarity for task comparison
   - Consider assignee + task combination

4. **Language Detection**
   - Auto-detect transcript language
   - Translate to English if needed

5. **User Feedback**
   - Add "correct this" UI
   - Track user corrections
   - Improve future extractions