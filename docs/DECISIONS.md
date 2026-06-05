# Technical Decisions

This document outlines key technical decisions made during development, including alternatives considered and trade-offs.

---

## Database Choice: MongoDB

### Why MongoDB
1. **Flexible Schema** - Meeting transcripts and AI analysis outputs have variable structures. MongoDB's document model allows storing complex nested objects without rigid schema enforcement.

2. **Developer Experience** - Mongoose provides an elegant ODM layer with validation, middleware, and a clean API.

3. **Scalability** - MongoDB scales horizontally through sharding for growing data volumes.

### Alternatives Considered
| Database | Reason Not Chosen |
|----------|-------------------|
| PostgreSQL | Requires more complex schema migrations for nested JSON data |
| MySQL | Less native JSON support than PostgreSQL |
| Redis | Not suitable for persistent data storage |

### Trade-offs
- **Pros:** Flexible, good for document-heavy data
- **Cons:** Less ACID guarantees, no native joins
- **Mitigation:** Zod validation enforces data structure before persistence

---

## Authentication Strategy: JWT + bcrypt

### Why JWT
1. **Stateless** - No shared session store needed for horizontal scaling
2. **Security** - bcrypt for password hashing, 7-day token expiration
3. **Simplicity** - Straightforward implementation in Node.js

### Alternatives Considered
| Strategy | Reason Not Chosen |
|----------|-------------------|
| OAuth2/Google Login | Requires external identity provider setup |
| Session-based Auth | Requires shared session store at scale |
| API Keys | Not suitable for user-facing apps |

### Trade-offs
- **Pros:** Simple, scalable, token-based
- **Cons:** Tokens not easily revoked before expiration
- **Mitigation:** 7-day expiration limits exposure window

---

## AI Integration: Google Gemini 2.5 Flash

### Why Gemini
1. **Cost-Effective** - Gemini Flash is significantly cheaper than GPT-4
2. **JSON Output** - Native JSON response format with `responseMimeType`
3. **System Instructions** - Precise control over output via system prompt
4. **Good Enough Quality** - Suitable for structured extraction tasks

### Prompt Design
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

### Key Design Principles
1. **Role Assignment** - Sets appropriate expertise context
2. **Explicit Requirements** - "MUST include citations" prevents hallucination
3. **JSON Schema** - Exact structure prevents format variations
4. **Temperature 0** - Deterministic, repeatable outputs

### Alternatives Considered
| Model | Reason Not Chosen |
|-------|-------------------|
| GPT-4 | Higher cost, marginal quality gain |
| Claude | Higher cost, similar quality |
| Local LLM (Llama) | Infrastructure investment required |

### Trade-offs
- **Pros:** Cost-effective, good JSON support
- **Cons:** May hit token limits for very long transcripts

---

## External Integration: Telegram Bot API

### Why Telegram
1. **Simplicity** - HTTP-based API, no OAuth complexity
2. **User Familiarity** - Users already have accounts
3. **Reliability** - High delivery rate, supports formatting
4. **Cost** - Free tier sufficient for the project

### Implementation
- Cron job runs every minute to check overdue items
- `reminder_sent` flag prevents duplicate reminders
- Messages include task, assignee, due date

### Alternatives Considered
| Channel | Reason Not Chosen |
|---------|-------------------|
| Email | Complex setup, spam filters |
| SMS | Cost per message |
| Slack | Requires app installation |

### Trade-offs
- **Pros:** Simple, free, reliable
- **Cons:** Users must have Telegram account

---

## Project Structure Decisions

```
project/
├── index.js           # Express app with routes
├── database.js        # Mongoose schemas and models
├── utils/             # Shared utilities (logger, validators)
├── validation/        # Zod schemas
├── schemas/           # Gemini AI output schemas
├── tests/             # Vitest test suite
├── docs/              # Documentation
└── logs/              # Log files
```

### Rationale
- **Single index.js** - Co-located routing and handlers for easier maintenance
- **Separate schemas** - Gemini schema distinct from request schemas
- **Validation folder** - Centralized Zod schemas
- **Logs folder** - Dedicated log rotation

### Trade-offs
- **index.js size** - 500+ lines but well-commented sections
- **No controllers folder** - Smaller team, faster iteration

---

## Validation Strategy: Zod

### Why Zod
1. **Type Safety** - Runtime type checking alongside TypeScript-like syntax
2. **JSON Schema Compatible** - Can convert to JSON Schema if needed
3. **Error Messages** - User-friendly validation messages
4. **No Build Step** - Works directly in Node.js

### Schema Organization
- **Request schemas** - Input validation at route level
- **Response schemas** - Output validation before sending
- **Gemini schemas** - Structured output from AI

### Trade-offs
- **Pros:** Flexible, good error messages, runtime checking
- **Cons:** Runtime overhead (minimal for this scale)

---

## Logging Strategy: Winston

### Why Winston
1. **Structured Logging** - JSON-friendly format for log aggregation
2. **Multiple Transports** - Console + file outputs
3. **Log Levels** - Error, warn, info, debug hierarchy
4. **Rotation** - Automatic file rotation and cleanup

### Log Format
```
2026-06-05T10:30:00.000Z INFO [abc123] Request received - POST /api/meetings
2026-06-05T10:30:00.100Z INFO [abc123] Meeting created - meetingId: xyz
```

### Including Trace IDs
- Each request gets unique traceId
- TraceId propagated through all logs for request correlation
- Error logs include full stack trace

### Trade-offs
- **Pros:** Debugging capability, trace correlation
- **Cons:** Slightly more complex setup

---

## Reminder System: Cron + Telegram

### Implementation
- `node-cron` runs every minute
- Queries for items with past due dates
- Sends Telegram messages
- Sets `reminder_sent` flag to prevent duplicates

### Alternatives Considered
| Strategy | Reason Not Chosen |
|----------|-------------------|
| setTimeout-based | Not persistent across restarts |
| External cron service | Added complexity |
| Webhook-based | User would need to configure |

### Trade-offs
- **Pros:** Simple, reliable
- **Cons:** 1-minute polling delay