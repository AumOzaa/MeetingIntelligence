# Changelog

All notable changes to this project are documented in this file.

---

## v2.0.0 - 2026-06-05

### Added
- **Winston logging middleware** - Structured logging with traceId correlation
- **Request logging** - All requests logged with method, path, query, body
- **Response logging** - All responses logged with status code and traceId
- **Error logging** - Full error stack traces with context
- **Info-level logging** - Key business operations logged (meeting creation, analysis, etc.)

### Modified
- **Log format** - Timestamp, level, traceId, message structure
- **Error responses** - Now include traceId for debugging
- **Health endpoint** - Removed duplicate `app.listen()` calls
- **Meeting schema** - Fixed `stuctured_output` typo to `structured_output`

### Technical Details

#### Log Output Format
```
2026-06-05T10:30:00.000Z INFO [abc123] Request received - POST /api/meetings
2026-06-05T10:30:00.100Z INFO [abc123] Response sent - POST /api/meetings - 201
2026-06-05T10:30:00.150Z INFO [abc123] Meeting created - meetingId: xyz
```

#### Error Log Format
```
2026-06-05T10:30:00.200Z ERROR [def456] {
  message: "Failed to analyze meeting",
  stack: "Error: ...",
  traceId: "def456",
  method: "POST",
  path: "/api/meetings/abc/analyze"
}
```

---

## v1.0.0 - Initial Release

### Added
- **Meeting API** - Create, list, and analyze meetings
- **AI Analysis** - Gemini 2.5 Flash integration for meeting transcription
- **Action Items** - Create, track, and update action items
- **Telegram Reminders** - Automated reminder system via Telegram Bot API
- **User Authentication** - JWT-based auth with bcrypt password hashing
- **Swagger Documentation** - OpenAPI 3.0 spec with `/api-docs` endpoint
- **Cron Scheduler** - node-cron for reminder jobs

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/meetings` | Create meeting with transcripts |
| GET | `/api/meetings` | List meetings with pagination |
| GET | `/api/meetings/:id` | Get meeting by ID |
| GET | `/api/meetings/:id/analyze` | Get meeting analysis |
| POST | `/api/meetings/:id/analyze` | Analyze meeting with Gemini |
| POST | `/api/action-items` | Create action item |
| GET | `/api/action-items` | List action items |
| PATCH | `/api/action-items/:id/status` | Update action item |
| GET | `/api/action-items/overdue` | Get overdue items |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| GET | `/api/evaluation` | Project evaluation info |

### Features

- **Meeting Intelligence** - Extract summaries, action items, decisions, suggestions
- **Citation Tracking** - Timestamp citations for all extracted items
- **Telegram Integration** - Reminder notifications via Telegram
- **Status Management** - Track action item status (Pending/In-Progress/Completed)
- **Due Date Reminders** - Automatic reminders for overdue items
- **User Authentication** - Email/password with JWT tokens
- **Pagination** - Support for large meeting lists
- **Filtering** - Filter action items by status, assignee, meeting

### Dependencies

- `express` - Web framework
- `mongoose` - MongoDB ODM
- `zod` - Schema validation
- `@google/genai` - Gemini AI integration
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication
- `node-cron` - Scheduled tasks
- `node-telegram-bot-api` - Telegram integration
- `swagger-ui-express` - API documentation
- `swagger-jsdoc` - OpenAPI spec generation
- `mongodb-memory-server` - Test database
- `vitest` - Test framework

### Project Structure

```
project/
├── index.js              # Express application
├── database.js           # Mongoose models
├── schemas/
│   └── geminiOutput.js   # Gemini output schema
├── validation/
│   ├── middleware.js     # Zod validation middleware
│   ├── schemas.js        # Request validation schemas
│   └── responseSchemas.js # Response validation schemas
├── tests/
│   ├── setup.js          # Test environment setup
│   ├── meetings.test.js  # Meeting API tests
│   └── actionItems.test.js # Action item tests
├── docs/                 # Project documentation
└── logs/                 # Log files
```

### Known Issues (v1.0.0)

1. **Duplicate API route handlers** - Multiple `app.listen()` calls in index.js
2. **Missing authentication middleware tests** - Tests don't cover auth flows
3. **No log rotation configuration** - Log files can grow unbounded