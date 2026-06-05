# AI Analysis Approach

This document explains how the Gemini AI integration works, from prompt design to output validation and known limitations.

---

## 1. Prompt Design

### System Prompt Strategy

The system prompt is carefully crafted to elicit consistent, high-quality structured outputs:

```
You are an expert project operations analyzer.

Extract:
- summaries
- action items
- decisions
- follow up suggestions

Every item MUST include timestamp citations from the transcript.
Return JSON in EXACTLY this structure:

{
  "summary": [...],
  "actionItems": [...],
  "decisions": [...],
  "followUpSuggestions": [...]
}

Do not use any other field names.
```

### Key Design Principles

1. **Role Assignment**
   - "Expert project operations analyzer" sets appropriate expertise context
   - Model assumes responsibility for analysis quality

2. **Explicit Extraction Categories**
   - Four specific categories requested (summary, actionItems, decisions, suggestions)
   - Clear separation of concerns
   - Prevents mixing or confusion between categories

3. **Citation Mandate**
   - "MUST include timestamp citations" (emphasized with caps)
   - Requires source references for credibility
   - Prevents hallucination by forcing grounding in transcript

4. **JSON Schema Specification**
   - Exact structure provided in prompt
   - "Do not use any other field names" prevents format variations
   - Enables strict validation on response

5. **Zero Temperature**
   - `temperature: 0` ensures deterministic outputs
   - Same input produces same output (beneficial for testing/verification)
   - Reduces randomness and creativity (intentional here)

### Prompt Optimization Techniques

**Specificity:** Instead of "extract key information," we specify exact categories.

```javascript
// ❌ Vague
"Extract important items from the meeting"

// ✅ Specific
"Extract summaries, action items, decisions, and follow-up suggestions"
```

**Constraint Emphasis:** Required fields are emphasized.

```javascript
"Every item MUST include timestamp citations"  // MUST = emphatic requirement
```

**Format Instruction:** Expected output format shown as example.

```javascript
"Return JSON in EXACTLY this structure: {...}"  // Shows exact format
```

---

## 2. Citation Strategy

### Why Citations Matter

Citations link AI-generated insights back to source material:
- **Audit Trail** - Users can verify AI interpretations
- **Trust Building** - Credibility increases with source references
- **Debugging** - Easy to identify where AI went wrong
- **Accountability** - Clear connection to meeting content

### Citation Format

```json
{
  "actionItems": [
    {
      "task": "Prepare release notes",
      "assignee": "Alice",
      "status": "Pending",
      "citations": [
        {"timestamp": "00:20"},
        {"timestamp": "00:45"}
      ]
    }
  ]
}
```

### Timestamp Format Validation

**Expected Format:** `MM:SS` or `HH:MM` (e.g., "00:10", "01:30")

**Regex Validation:** `/^\d{2,3}:\d{2}$/`
- Allows 2-3 digit hours (00-999)
- Requires 2-digit minutes (00-59)
- Supports formats: MM:SS, HH:MM, HHH:MM

**Implementation:**
```javascript
CitationSchema = z.object({
  timestamp: z.string().regex(/^\d{2,3}:\d{2}$/, "Invalid timestamp format")
});
```

### Citation Best Practices

1. **Multiple Citations** - Complex items should have multiple citations
   ```javascript
   "citations": z.array(CitationSchema).min(1)  // At least one citation required
   ```

2. **Chronological Order** - Citations in transcript order (optional but helpful)
   ```json
   "citations": [{"timestamp": "00:20"}, {"timestamp": "00:45"}]
   ```

3. **Precision** - Cite the exact moment idea was mentioned
   - Not just "somewhere in the meeting"
   - Specific timestamps enable users to jump to exact location

---

## 3. Hallucination Prevention Approach

### Multi-Layer Prevention Strategy

#### Layer 1: Request Validation
```javascript
// Validate input BEFORE sending to AI
CreateMeetingRequestSchema = z.object({
  transcript: z.array(TranscriptSchema).min(1)
})

// Prevents:
// - Empty transcripts
// - Invalid speaker/text format
// - Malformed timestamps
```

**Effect:** Ensures AI receives well-formed input

#### Layer 2: Prompt Engineering
```javascript
// Explicit constraints in system prompt
"Every item MUST include timestamp citations"
"Do not use any other field names"
"Return JSON in EXACTLY this structure"

// Temperature = 0
config: { temperature: 0 }
```

**Effect:** Deterministic, constrained outputs

#### Layer 3: Schema Validation
```javascript
// Validate Gemini output BEFORE storing
ActionItemSchema = z.object({
  task: z.string(),
  assignee: z.string(),
  status: z.enum(["Pending", "In-Progress", "Completed"]),
  citations: z.array(CitationSchema).min(1)  // Must have citations
})

const structuredOutput = MeetingIntelligenceSchema.parse(rawJson);
```

**Effect:** Rejects invalid/hallucinated outputs

#### Layer 4: Error Handling
```javascript
// Invalid output triggers error response
try {
  const output = MeetingIntelligenceSchema.parse(geminiResponse);
} catch (error) {
  return res.status(400).json({
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "AI output validation failed"
    }
  });
}
```

**Effect:** No invalid data reaches database

### Known Vulnerabilities

Despite preventive measures, some risks remain:

1. **Plausible-but-False Data**
   - AI could generate valid JSON with invented citations
   - "Task X assigned to Alice" (never mentioned in transcript)
   - Validation can't detect semantic falsity

2. **Timestamp Hallucination**
   - AI invents timestamps that don't exist
   - Validation checks format only, not authenticity
   - Could cite "00:99" (impossible time) - prevented by regex

3. **Context Truncation**
   - Very long transcripts may exceed token limits
   - AI sees partial context, extracts from visible portion
   - Important decisions early in transcript may be ignored

4. **Ambiguous Attribution**
   - Multiple people with same name in transcript
   - AI may assign task to wrong person
   - No disambiguation in prompt

### Mitigation Strategies

**For Plausible-but-False Data:**
- Implement user feedback mechanism (mark as wrong)
- Train fine-tuned model on corrections
- Add confidence scores to outputs

**For Timestamp Hallucination:**
- Validate timestamps against actual transcript
- Warn if citation timestamp not in transcript
- Implement fuzzy matching for close timestamps

**For Context Truncation:**
- Implement transcript chunking for long files
- Summarize sections and analyze separately
- Merge results at the end

**For Ambiguous Attribution:**
- Request speaker email/ID in transcript
- Include full names in prompt
- Ask AI to request clarification if ambiguous

---

## 4. Output Validation Strategy

### Two-Tier Validation Architecture

#### Tier 1: Request Validation (Client → Server)

```javascript
const CreateMeetingRequestSchema = z.object({
  title: z.string().min(1, "Title required"),
  participants: z.array(z.string().email()),
  meetingDate: z.string().refine(
    date => !isNaN(Date.parse(date)),
    { message: "Invalid date format" }
  ),
  transcript: z.array(TranscriptSchema).min(1)
});
```

**Validated Fields:**
- Title: non-empty string
- Participants: valid email addresses
- Meeting Date: parseable ISO 8601 date
- Transcript: array with at least 1 entry, each with valid timestamp

**Response on Failure:**
```json
{
  "traceId": "abc123...",
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Meeting title is required"
  }
}
```

#### Tier 2: Response Validation (Server → Database)

```javascript
const MeetingIntelligenceSchema = z.object({
  summary: z.array(SummaryItemSchema),
  actionItems: z.array(ActionItemSchema),
  decisions: z.array(DecisionItemSchema),
  followUpSuggestions: z.array(FollowUpSuggestionSchema)
});
```

**Validates AI Output:**
- All required fields present
- Correct data types
- Arrays have minimum items where required
- Citations have proper format

**Validation Flow:**
```
Gemini Response (JSON string)
         ↓
JSON.parse(response.text)
         ↓
MeetingIntelligenceSchema.parse(parsed)
         ↓
✓ Valid: Store in database
✗ Invalid: Return error response
```

#### Tier 3: Database Schema

```javascript
const meetingSchema = new mongoose.Schema({
  transcripts: Object,           // Input transcript data
  structured_output: Object,     // Validated Gemini output
  created_at: { type: Date, default: Date.now() }
});
```

**Schema Constraints:**
- No strict validation at DB level (flexibility)
- Indexes on frequently queried fields
- TTL indexes for log cleanup (future)

### Edge Cases Handled

| Case | Validation | Result |
|------|-----------|--------|
| Empty transcript | `.min(1)` | Rejected at request level |
| Invalid email | `.email()` | Rejected at request level |
| Missing citations | `.min(1)` on array | Rejected at response level |
| Invalid timestamp | Regex check | Rejected at response level |
| Extra fields | Strict schema | Ignored/stripped by Zod |
| Null values | `.or(z.null())` for optional | Accepted where specified |

---

## 5. Known Limitations

### 1. Citation Timestamp Format
**Issue:** Regex validation only checks format, not validity
- Accepts `99:99` (invalid time)
- Doesn't validate against actual transcript length
- Can't detect invented timestamps

**Example:**
```json
{
  "citations": [{"timestamp": "99:99"}]  // ✓ Passes validation (wrong!)
}
```

**Impact:** Medium - format is correct but semantically invalid
**Mitigation:** Add timestamp range validation against actual transcript length

### 2. No Retry Logic
**Issue:** Gemini API failures cause analysis to be lost
- No exponential backoff
- No retry mechanism
- Single point of failure

**Impact:** Medium - depends on Gemini availability
**Mitigation:** Implement retry with exponential backoff:
```javascript
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

### 3. Action Item Deduplication
**Issue:** Based only on task text, ignores context
- Different assignments to same task seen as duplicate
- "Task A" assigned to Alice and "Task A" assigned to Bob treated as same

**Example:**
```
Meeting 1: "Alice will prepare release notes"
Meeting 2: "Bob will prepare release notes"  // Skipped as duplicate!
```

**Impact:** Low - rare case
**Mitigation:** Include assignee in dedup logic:
```javascript
const existing = await ActionItem.findOne({
  meeting_id: id,
  task: actionItemData.task,
  assignee: actionItemData.assignee  // Add assignee to uniqueness
});
```

### 4. No Meeting Duration Validation
**Issue:** No checks on transcript length
- Very long transcripts may hit token limits
- No error if transcript too long
- Analysis fails silently

**Impact:** Medium - depends on transcript size
**Mitigation:** Check token count before processing:
```javascript
const tokenCount = countTokens(meetingPayload);
if (tokenCount > 30000) {
  return res.status(400).json({
    error: { code: "TRANSCRIPT_TOO_LONG" }
  });
}
```

### 5. Single Language Support
**Issue:** Prompt is English-only
- Non-English transcripts produce poor results
- No language detection
- No translation integration

**Impact:** Low - users should provide English transcripts
**Mitigation:** Add language detection and auto-translation:
```javascript
const language = detectLanguage(transcript);
if (language !== 'en') {
  transcript = await translateToEnglish(transcript);
}
```

### 6. Reminder Timing
**Issue:** Cron job runs every minute
- Lead times <1 minute may be missed
- Not real-time notifications
- Can skip reminders if server restarts

**Impact:** Low - acceptable for task reminders
**Mitigation:** Increase check frequency or use message queue:
```javascript
cron.schedule("*/30 * * * * *");  // Every 30 seconds
// Or use: Redis queue, Bull, RabbitMQ
```

### 7. No User Feedback Loop
**Issue:** Users can't correct AI extractions
- No "mark as wrong" mechanism
- No fine-tuning based on corrections
- Same mistakes repeated

**Impact:** Medium - reduces AI quality over time
**Mitigation:** Implement feedback collection:
```javascript
app.post("/api/action-items/:id/feedback", async (req, res) => {
  const { feedback, correctedData } = req.body;
  // Store feedback for analysis
  // Use to improve future prompts
});
```

### 8. Context Limits
**Issue:** Gemini Flash has ~32k token context window
- Very long transcripts get truncated
- No chunking implementation
- Important content may be cut off

**Example:**
```
Transcript length: 50,000 tokens
Gemini limit: 32,000 tokens
Result: Last 18,000 tokens ignored
```

**Impact:** High for long meetings
**Mitigation:** Implement transcript chunking:
```javascript
const chunks = chunkTranscript(transcript, 25000);  // Safety margin
const analyses = await Promise.all(
  chunks.map(chunk => analyzeChunk(chunk))
);
const merged = mergeAnalyses(analyses);
```

---

## 6. Future Improvements

### Short Term (1-2 sprints)
- [ ] Add timestamp validation against actual transcript
- [ ] Implement retry logic with exponential backoff
- [ ] Improve deduplication logic to consider assignee

### Medium Term (1-2 months)
- [ ] Language detection and auto-translation
- [ ] User feedback collection mechanism
- [ ] Confidence scoring for extracted items
- [ ] Transcript chunking for large files

### Long Term (3-6 months)
- [ ] Fine-tune Gemini model on domain-specific data
- [ ] Implement multi-modal support (audio → transcript)
- [ ] Real-time streaming analysis during meetings
- [ ] Integration with calendar/CRM systems
- [ ] Competitor comparison (Claude, GPT-4)

---

## Appendix: Example Analysis Output

### Input Transcript
```json
{
  "title": "Sprint Planning",
  "transcript": [
    {
      "timestamp": "00:10",
      "speaker": "Alice",
      "text": "We need to launch next Friday"
    },
    {
      "timestamp": "00:20",
      "speaker": "Bob",
      "text": "I'll prepare release notes for the launch"
    },
    {
      "timestamp": "00:35",
      "speaker": "Charlie",
      "text": "Let's do a final QA review before release"
    }
  ]
}
```

### AI-Generated Output
```json
{
  "summary": [
    {
      "text": "Team committed to Friday launch with preparation tasks",
      "citations": [{"timestamp": "00:10"}]
    }
  ],
  "actionItems": [
    {
      "task": "Prepare release notes",
      "assignee": "Bob",
      "status": "Pending",
      "citations": [{"timestamp": "00:20"}]
    },
    {
      "task": "Final QA review",
      "assignee": "Charlie",
      "status": "Pending",
      "citations": [{"timestamp": "00:35"}]
    }
  ],
  "decisions": [
    {
      "decision": "Launch on Friday",
      "citations": [{"timestamp": "00:10"}]
    }
  ],
  "followUpSuggestions": [
    {
      "suggestion": "Complete QA review before release",
      "citations": [{"timestamp": "00:35"}]
    }
  ]
}
```
