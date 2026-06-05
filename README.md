# Meeting Intelligence API

A Node.js Express API that uses Google's Gemini AI to analyze meeting transcripts, extract actionable insights, and send reminders via Telegram.

## Table of Contents
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Local Execution](#local-execution)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Architecture](#architecture)
- [Contributing](#contributing)

---

## Features

✨ **Core Capabilities**
- 📝 Meeting transcript storage and management
- 🤖 AI-powered analysis using Google Gemini 2.5 Flash
- 📋 Automatic action item extraction with assignees and due dates
- 🔐 User authentication with JWT tokens
- 📱 Telegram reminders for overdue tasks
- 📊 Swagger API documentation
- 🔍 Comprehensive logging with trace IDs
- ✅ Input validation with Zod schemas

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 18+ |
| **Framework** | Express 5.x |
| **Database** | MongoDB + Mongoose ODM |
| **AI** | Google Gemini 2.5 Flash API |
| **Authentication** | JWT + bcrypt |
| **Validation** | Zod |
| **Logging** | Winston |
| **Testing** | Vitest + Supertest |
| **Notifications** | Telegram Bot API |
| **Scheduling** | node-cron |
| **Documentation** | Swagger/OpenAPI 3.0 |

---

## Setup Instructions

### Prerequisites
- Node.js 18.x or higher
- npm or yarn package manager
- MongoDB instance (local or cloud)
- Google Gemini API key
- Telegram Bot token

### Clone & Install

```bash
# Clone the repository
git clone https://github.com/yourusername/meeting-intelligence.git
cd meeting-intelligence

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

### Install Dependencies

```bash
npm install
```

The project includes the following key packages:
```json
{
  "express": "^5.2.1",
  "mongoose": "^9.6.3",
  "zod": "^4.4.3",
  "@google/genai": "^2.8.0",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.0",
  "node-telegram-bot-api": "^0.63.0",
  "swagger-ui-express": "^5.0.0",
  "winston": "^3.11.0",
  "node-cron": "^3.0.2"
}
```

---

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Database
MONGO_URI=mongodb://localhost:27017/meeting-intelligence
# For MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/meeting-intelligence?retryWrites=true&w=majority

# AI/LLM
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Authentication
JWT_SECRET=your_secret_key_here_min_32_chars
JWT_EXPIRY=7d

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# External Services (Optional)
SENTRY_DSN=
BUGSNAG_API_KEY=
```

### Getting API Keys

#### Google Gemini API
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Get API Key"
3. Create a new API key
4. Copy and paste into `.env`

#### Telegram Bot Token
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Create a new bot with `/newbot`
3. Follow the prompts and receive your token
4. Get your Chat ID by messaging your bot and visiting:
   ```
   https://api.telegram.org/botYOUR_TOKEN/getUpdates
   ```

#### MongoDB Connection
- **Local:** `mongodb://localhost:27017/meeting-intelligence`
- **MongoDB Atlas:** Get connection string from https://www.mongodb.com/cloud/atlas

---

## Local Execution

### 1. Start MongoDB (if running locally)

```bash
# macOS with Homebrew
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 2. Verify Environment Variables

```bash
# Check .env is configured correctly
cat .env | grep -E "GEMINI_API_KEY|MONGO_URI|TELEGRAM_BOT_TOKEN"
```

### 3. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start

# Server runs on http://localhost:3000
```

### 4. Verify Server is Running

```bash
# Check API health
curl http://localhost:3000/api/evaluation

# Expected response:
# {
#   "candidateName": "Aum Oza",
#   "email": "aumoza404@gmail.com",
#   "features": ["Authentication", "AI Analysis", "Reminder Scheduler"]
# }
```

### 5. View API Documentation

```
http://localhost:3000/api-docs
```

### 6. Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/meetings.test.js

# Run with coverage
npm test -- --coverage
```

### 7. View Logs

```bash
# Follow real-time logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log
```

---

## Deployment

### Heroku Deployment

```bash
# Install Heroku CLI
brew tap heroku/brew && brew install heroku

# Login to Heroku
heroku login

# Create app
heroku create meeting-intelligence-api

# Set environment variables
heroku config:set GEMINI_API_KEY=your_key
heroku config:set MONGO_URI=your_mongodb_uri
heroku config:set JWT_SECRET=your_secret
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set TELEGRAM_CHAT_ID=your_chat_id

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
```

```bash
# Build and run
docker build -t meeting-intelligence .
docker run -p 3000:3000 --env-file .env meeting-intelligence
```

### AWS ECS Deployment

```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

docker build -t meeting-intelligence .
docker tag meeting-intelligence:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/meeting-intelligence:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/meeting-intelligence:latest

# Create ECS task definition and service
aws ecs create-service --cluster production --service-name meeting-intelligence --task-definition meeting-intelligence:1 --desired-count 2
```

### Google Cloud Run Deployment

```bash
# Deploy to Cloud Run
gcloud run deploy meeting-intelligence \
  --source . \
  --region us-central1 \
  --set-env-vars GEMINI_API_KEY=xxx,MONGO_URI=xxx

# View logs
gcloud run logs read meeting-intelligence --limit 50
```

### Environment-Specific Configuration

#### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
MONGO_URI=mongodb://localhost:27017/meeting-intelligence
```

#### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
MONGO_URI=mongodb+srv://user:pass@staging.mongodb.net/meeting-intelligence
```

#### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
MONGO_URI=mongodb+srv://user:pass@prod.mongodb.net/meeting-intelligence
```

---

## API Documentation

### Authentication

All endpoints (except `/api/auth/*` and `/api/evaluation`) require a JWT token.

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'

# Response:
# {
#   "success": true,
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }
```

Use the token in subsequent requests:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/meetings
```

### Meeting Endpoints

#### Create Meeting
```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sprint Planning",
    "participants": ["alice@example.com", "bob@example.com"],
    "meetingDate": "2026-06-05T10:00:00Z",
    "transcript": [
      {
        "timestamp": "00:10",
        "speaker": "Alice",
        "text": "We should launch next Friday"
      },
      {
        "timestamp": "00:20",
        "speaker": "Bob",
        "text": "I will prepare release notes"
      }
    ]
  }'

# Response:
# {
#   "traceId": "abc123...",
#   "success": true,
#   "data": {
#     "_id": "507f1f77bcf86cd799439011",
#     "transcripts": {...},
#     "created_at": "2026-06-05T10:00:00Z"
#   }
# }
```

#### Get All Meetings
```bash
curl -X GET "http://localhost:3000/api/meetings?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# With filtering:
curl -X GET "http://localhost:3000/api/meetings?status=Pending&assignee=Alice" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Meeting by ID
```bash
curl -X GET http://localhost:3000/api/meetings/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Analyze Meeting (Generate AI Insights)
```bash
curl -X POST http://localhost:3000/api/meetings/507f1f77bcf86cd799439011/analyze \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
# {
#   "traceId": "abc123...",
#   "success": true,
#   "data": {
#     "structuredOutput": {
#       "summary": [
#         {
#           "text": "Team discussed launch timeline",
#           "citations": [{"timestamp": "00:10"}]
#         }
#       ],
#       "actionItems": [
#         {
#           "task": "Prepare release notes",
#           "assignee": "Bob",
#           "status": "Pending",
#           "citations": [{"timestamp": "00:20"}]
#         }
#       ],
#       "decisions": [...],
#       "followUpSuggestions": [...]
#     },
#     "actionItems": {
#       "total": 1,
#       "created": 1,
#       "skipped": 0
#     }
#   }
# }
```

### Action Items Endpoints

#### Create Action Item
```bash
curl -X POST http://localhost:3000/api/action-items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "507f1f77bcf86cd799439011",
    "task": "Write documentation",
    "assignee": "Charlie",
    "status": "Pending"
  }'
```

#### Get Action Items
```bash
# Get all
curl -X GET http://localhost:3000/api/action-items \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by status
curl -X GET "http://localhost:3000/api/action-items?status=Pending" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by assignee
curl -X GET "http://localhost:3000/api/action-items?assignee=Bob" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Update Action Item Status
```bash
curl -X PATCH http://localhost:3000/api/action-items/507f1f77bcf86cd799439012/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Completed",
    "due_date": "2026-06-10T17:00:00Z"
  }'
```

#### Get Overdue Items
```bash
curl -X GET http://localhost:3000/api/action-items/overdue \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
# {
#   "traceId": "xyz789...",
#   "success": true,
#   "data": {
#     "count": 2,
#     "data": [
#       {
#         "_id": "507f1f77bcf86cd799439012",
#         "task": "Prepare release notes",
#         "assignee": "Bob",
#         "status": "Pending",
#         "due_date": "2026-06-03T17:00:00Z"
#       }
#     ]
#   }
# }
```

---

## Architecture

### Request Flow
```
Client Request
    ↓
Logging Middleware (traceId)
    ↓
Authentication Middleware (JWT)
    ↓
Validation Middleware (Zod)
    ↓
Route Handler
    ↓
Business Logic (Meeting, AI, ActionItem)
    ↓
Database (MongoDB)
    ↓
Structured Response (with traceId)
    ↓
Response Logging
    ↓
Client
```

### Directory Structure
```
project/
├── index.js                      # Express app and routes
├── database.js                   # Mongoose schemas and models
├── utils/
│   └── logger.js                # Winston logger configuration
├── validation/
│   ├── middleware.js             # Zod validation middleware
│   ├── schemas.js                # Request validation schemas
│   └── responseSchemas.js        # Response validation schemas
├── schemas/
│   └── geminiOutput.js           # Gemini AI output schemas
├── tests/
│   ├── setup.js                 # Test environment setup
│   ├── meetings.test.js         # Meeting API tests
│   ├── actionItems.test.js      # Action item tests
│   └── mockGemini.js            # Gemini mock response
├── docs/
│   ├── README.md                # Overview
│   ├── DECISIONS.md             # Technical decisions
│   ├── AI_APPROACH.md           # AI strategy
│   ├── TESTING.md               # Test documentation
│   └── CHANGELOG.md             # Version history
├── logs/                         # Log files (auto-generated)
├── .env.example                 # Environment template
├── package.json                 # Dependencies
└── vitest.config.js             # Test configuration
```

### Database Schema

#### Meeting
```javascript
{
  _id: ObjectId,
  transcripts: {
    title: String,
    participants: [String],
    meetingDate: Date,
    transcript: [{
      timestamp: String,
      speaker: String,
      text: String
    }]
  },
  structured_output: {
    summary: [...],
    actionItems: [...],
    decisions: [...],
    followUpSuggestions: [...]
  },
  created_at: Date
}
```

#### ActionItem
```javascript
{
  _id: ObjectId,
  meeting_id: [ObjectId],
  task: String,
  assignee: String,
  status: String,
  due_date: Date,
  reminder_sent: Boolean,
  created_at: Date
}
```

#### User
```javascript
{
  _id: ObjectId,
  email: String (unique),
  password: String (bcrypt hashed),
  createdAt: Date,
  updatedAt: Date
}
```

---

## Error Handling

All error responses follow a standard format:

```json
{
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Meeting title is required"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `NOT_FOUND` | 400 | Resource not found |
| `UNAUTHORIZED` | 401 | Authentication failed |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Logging

Logs are written to:
- **Console** - Real-time output with color coding
- **logs/combined.log** - All logs
- **logs/error.log** - Error logs only

Log format:
```
2026-06-05T10:30:00.000Z INFO [abc123] Message
```

View logs:
```bash
# Real-time
tail -f logs/combined.log

# Last 50 lines
tail -50 logs/combined.log

# Search for errors
grep ERROR logs/combined.log

# Filter by traceId
grep "abc123" logs/combined.log
```

---

## Contributing

1. Create a feature branch
```bash
git checkout -b feature/your-feature
```

2. Make changes and test
```bash
npm test
```

3. Commit with conventional commits
```bash
git commit -m "feat: add new feature"
```

4. Push and create pull request
```bash
git push origin feature/your-feature
```

---

## Troubleshooting

### MongoDB Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Start MongoDB or update MONGO_URI in .env

### Gemini API Key Invalid
```
Error: API key not valid
```
**Solution:** Verify GEMINI_API_KEY in .env from Google AI Studio

### Tests Failing
```bash
# Clear test database
npm test -- --clearCache

# Run with verbose output
npm test -- --reporter=verbose
```

### Port Already in Use
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Use different port
PORT=3001 npm start
```

---

## License

ISC License - See LICENSE file for details

---

## Support

For issues and questions:
- Check existing [GitHub Issues](https://github.com/yourusername/meeting-intelligence/issues)
- Review [documentation](./docs)
- Create a new issue with reproduction steps

---

## Changelog

See [CHANGELOG.md](./docs/CHANGELOG.md) for version history and major changes.
