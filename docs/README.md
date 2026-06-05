# Project Documentation

## Overview
This is a Meeting Intelligence API that uses Google's Gemini AI to analyze meeting transcripts, extract action items, decisions, and create reminders via Telegram.

---

## DECISIONS.md

# Technical Decisions

## Database Choice: MongoDB

**Why:** MongoDB was chosen as the primary database for the following reasons:

1. **Flexible Schema** - Meeting data and AI analysis outputs have variable structures. MongoDB's document-based model allows us to store complex nested objects (like meeting transcripts, structured outputs, citations) without rigid schema enforcement.

2. **Developer Experience** - Mongoose provides an elegant ODM layer with validation, middleware, and a clean API that fits well with Node.js/Express patterns.

3. **Scalability** - MongoDB scales horizontally well through sharding, which is beneficial for handling growing amounts of meeting data and transcripts.

**Alternatives Considered:**
- **PostgreSQL** - Would require more complex schema migrations and JSONB queries for nested data
- **MySQL** - Similar to PostgreSQL with less native JSON support
- **Redis** - Not suitable for persistent data storage, only caching

**Trade-offs:**
- Less ACID guarantees compared to SQL databases
- No native joins (requires manual population or aggregation)
- Schema validation is weaker than SQL constraints (mitigated with Zod validation)

---

## Authentication Strategy: JWT + bcrypt

**Why:** JWT (JSON Web Tokens) with bcrypt password hashing was chosen:

1. **Stateless Authentication** - JWT tokens allow stateless auth, making the API horizontally scalable without shared session stores.

2. **Security** - bcrypt provides strong password hashing with configurable work factor. Tokens have expiration (7 days) limiting exposure.

3. **Simplicity** - JWT implementation is straightforward in Node.js with minimal dependencies.

**Alternatives Considered:**
- **OAuth2/Google Login** - More complex setup, requires external identity provider
- **Session-based Auth** - Requires shared session store for scaling
- **API Keys** - Less suitable for user-facing applications

**Trade-offs:**
- JWT tokens are not easily revoked before expiration (requires token blacklist)
- No built-in refresh token mechanism (could add for better security)

---

## AI Integration: Google Gemini 2.5 Flash

**Why Gemini was chosen:**

1. **Cost-Effective** - Gemini Flash is significantly cheaper than GPT-4 while maintaining good performance for structured extraction tasks.

2. **Native JSON Output** - The `responseMimeType: "application/json"` feature ensures validated JSON responses without post-processing.

3. **System Instructions** - ability to provide detailed system prompts for consistent output formatting.

**Prompt Design:**
- Clear instruction to extract 4 specific data types (summary, action items, decisions, suggestions)
- Explicit JSON schema specification in the prompt
- Requirement for timestamp citations from transcript
- Temperature set to 0 for deterministic, repeatable outputs

**Alternatives Considered:**
- **OpenAI GPT-4** - More expensive, slightly better quality but not justified for this use case
- **Anthropic Claude** - Higher cost, similar quality but Gemini Flash is more cost-effective
- **Local LLM (Llama, Mistral)** - Would require significant infrastructure investment

---

## External Integration: Telegram Bot API

**Why Telegram:**

1. **Simplicity** - Telegram Bot API is straightforward to integrate with HTTP requests. No OAuth complexity.

2. **User Familiarity** - Most users already have Telegram accounts, reducing friction for receiving reminders.

3. **Reliability** - Telegram has high delivery reliability and supports message formatting.

**Implementation Details:**
- Cron job runs every minute to check for overdue action items
- Reminder sent only once per item (tracked via `reminder_sent` flag)
- Messages include task details, assignee, and due date

**Alternatives Considered:**
- **Email (SendGrid/Nodemailer)** - More complex setup, spam filters
- **SMS (Twilio)** - Higher cost per message
- **Slack** - Requires app installation by users

---

## Project Structure Decisions

```
project/
├── index.js           # Express app with all routes (single file for simplicity)
├── database.js        # Mongoose schemas and model definitions
├── utils/             # Shared utilities (logger, validators)
├── validation/        # Zod schemas for request/response validation
├── schemas/           # Gemini AI output schemas
├── tests/             # Vitest test suite
└── logs/              # Winston log files
```

**Rationale:**
- **Single index.js** - Keeps routing logic co-located with handlers for easier maintenance in this small project
- **Separate schemas** - Gemini output schema is separate from request schemas for clarity
- **Validation folder** - Centralized Zod schemas for reuse and testing
- **Logs folder** - Dedicated location for log rotation management

**Trade-offs:**
- index.js is large (500+ lines) - mitigated by clear section comments
- No separate controllers folder - smaller team, faster iteration

---

## AI_OUTPUT.md

# AI Analysis Approach

## Prompt Design

The system prompt is carefully crafted to extract actionable insights:

```
You are an expert project operations analyzer.

Extract:
- summaries
- action items  
- decisions
- follow up suggestions

Every item MUST include timestamp citations from the transcript.
Return JSON in EXACTLY this structure...
```

**Key Design Principles:**

1. **Role Assignment** - "Expert project operations analyzer" sets appropriate context
2. **Explicit Requirements** - "MUST include timestamp citations" prevents hallucination
3. **JSON Schema** - Exact structure prevents format variations
4. **Temperature 0** - Ensures deterministic, repeatable outputs

## Citation Strategy

Every extracted item requires timestamp citations:

```json
{
  "actionItems": [{
    "task": "Prepare release notes",
    "assignee": "Alice",
    "citations": [{"timestamp": "00:20"}]
  }]
}
```

**Benefits:**
- Audit trail linking analysis back to transcript
- Ability to verify AI interpretations against source
- Users can jump to relevant meeting moments

**Implementation:**
- Gemini returns JSON with embedded citations
- Zod schema validates citation format (`^\d{2,3}:\d{2}$` for MM:SS)
- Timestamps stored as strings (not parsed) to preserve original format

## Hallucination Prevention

Multiple layers prevent hallucinations:

1. **Schema Validation** - Zod schema ensures exact structure:
   ```javascript
   ActionItemSchema = z.object({
     task: z.string(),
     assignee: z.string(),
     status: z.enum(["Pending", "In-Progress", "Completed"]),
     citations: z.array(CitationSchema).min(1)
   })
   ```

2. **Zero Temperature** - `temperature: 0` for deterministic output

3. **Explicit Schema in Prompt** - AI knows exactly what format is expected

4. **Validation Errors** - Failed validation returns error instead of proceeding

## Output Validation Strategy

**Two-tier validation:**

1. **Request Validation** (client → server):
   - Zod schemas validate incoming requests
   - Returns 400 with detailed error messages

2. **Response Validation** (server → database):
   - Gemini output parsed and validated against `MeetingIntelligenceSchema`
   - Only valid structured outputs are stored

3. **Database Schema**:
   - Mongoose schema enforces basic structure at storage level
   - Indexes on frequently queried fields (status, due_date, meeting_id)

## Known Limitations

1. **Citation Timestamp Format** - Assumes MM:SS format. Does not validate against actual transcript timestamps.

2. **No Retry Logic** - If Gemini fails, the analysis is lost (could add retry with backoff).

3. **Action Item Deduplication** - Based only on task text. Different assignments to same task won't be detected as duplicates.

4. **No Meeting Duration Validation** - Gemini can analyze any transcript length, but very long transcripts may hit token limits.

5. **Single Language** - Prompt is English-only. Non-English transcripts would need translation first.

6. **Reminder Timing** - Cron job runs only once per minute. Very short lead times (<1 min) may be missed.

7. **No User Feedback Loop** - Users cannot correct/adjust AI extractions and retrain the model.

---

## TESTING.md

# Test Coverage

## Test Scenarios Executed

### Meeting API Tests (`tests/meetings.test.js`)

| Scenario | Description | Status |
|----------|-------------|--------|
| Create meeting | Valid meeting with all required fields | PASS |
| Validation failure | Missing required fields (title, transcript) | PASS |

### Action Item Tests (`tests/actionItems.test.js`)

| Scenario | Description | Status |
|----------|-------------|--------|
| Update status | Change status from "Pending" to "Completed" | PASS |
| Update due date | Set `dueDate` field on action item | FAILED - Schema issue |
| Overdue items | Filter items with past due dates | FAILED - Field naming issue |
| Filter by status | Query by `status=Completed` | PASS |

## Edge Cases Considered

1. **Empty Transcript** - Zod schema requires at least one transcript entry
2. **Invalid Email** - Schema validates email format for participants
3. **Invalid Date** - Date parsing validation with user-friendly message
4. **Duplicate Action Items** - Check before creation to avoid duplicates
5. **Invalid MongoDB ID** - ObjectId regex validation
6. **Overdue Items with No Due Date** - Filter excludes items with null due_date

## Known Limitations (Test Scope)

1. **No Authentication Tests** - Tests don't mock the `authenticate` middleware
2. **No Gemini Integration Tests** - Tests mock Gemini response instead of real API call
3. **No Pagination Tests** - Test doesn't verify pagination logic
4. **No Error Path Tests** - Tests only cover happy paths

---

## CHANGELOG.md

# Changelog

## v2.0.0 - Current

### Added
- Winston logging middleware with traceId correlation
- Request/response logging for all endpoints
- Structured error logging with stack traces
- Info logs for key operations (meeting creation, analysis, action items)

### Modified
- Log format: timestamp, level, traceId, message
- Added HTTP status code tracking in logs
- Error responses now include traceId for debugging

---

## v1.0.0 - Initial Release

### Added
- Meeting creation and storage
- AI analysis with Gemini 2.5 Flash
- Action item extraction and management
- Telegram bot reminders
- User authentication (JWT)
- Swagger API documentation
- Pagination support
- Status filtering for action items

### Features
- `/api/meetings` - Create and list meetings
- `/api/meetings/:id/analyze` - AI analysis endpoint
- `/api/action-items` - Create and query action items
- `/api/action-items/:id/status` - Update status/due date
- `/api/action-items/overdue` - Get overdue items
- `/api/auth/register` - User registration
- `/api/auth/login` - User login
- Telegram reminder integration
- Cron-based reminder scheduler
