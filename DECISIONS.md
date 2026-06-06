# Technical Decisions

This document outlines key technical decisions made during development, including alternatives considered and trade-offs.

---

## 1. Database Choice: MongoDB

### Why MongoDB
1. **Flexible Schema** - Meeting transcripts and AI analysis outputs have variable structures. MongoDB's document model allows storing complex nested objects without rigid schema enforcement.

2. **Developer Experience** - Mongoose provides an elegant ODM layer with validation, middleware, and a clean API that integrates well with Node.js.

3. **Scalability** - MongoDB scales horizontally through sharding, supporting growth in meeting data and transcripts.

4. **JSON-like Documents** - Natural fit for JavaScript/Node.js development with JSON-compatible data structures.

### Alternatives Considered
| Database | Reason Not Chosen |
|----------|-------------------|
| PostgreSQL | Requires complex schema migrations for nested JSON data; JSONB queries less intuitive |
| MySQL | Less native JSON support; requires normalization of nested structures |
| DynamoDB | Overkill for this project; higher AWS costs; limited free tier |
| Redis | Only for caching; not suitable for persistent data storage |

### Trade-offs
| Pros | Cons |
|------|------|
| Flexible schema for variable data | Weaker ACID guarantees vs SQL |
| Good for document-heavy data | No native joins (requires workarounds) |
| Horizontal scaling with sharding | Schema validation weaker than SQL constraints |
| Great JavaScript integration | Data duplication risk if not careful |

### Mitigation
- **Validation:** Zod schemas enforce data structure before persistence
- **Indexing:** Strategic indexes on frequently queried fields
- **Transactions:** Mongoose transactions for multi-document operations

---

## 2. Authentication Strategy: JWT + bcrypt

### Why JWT (JSON Web Tokens)
1. **Stateless Authentication** - No shared session store needed; enables horizontal scaling without session affinity.

2. **Security** - bcrypt provides strong password hashing with configurable work factor. 7-day token expiration limits exposure window.

3. **Simplicity** - Straightforward implementation; minimal dependencies; token-based approach fits REST API pattern.

4. **Cross-Domain** - Supports CORS and multiple client domains without session complications.

### Alternatives Considered
| Strategy | Reason Not Chosen |
|----------|-------------------|
| OAuth2/Google Login | Requires external identity provider; adds complexity for simple auth |
| Session-based Auth (Express-session) | Requires shared session store (Redis/Memcached) for scaling |
| API Keys | Not suitable for user-facing applications; no user context |
| SAML | Overkill for this project; enterprise-level complexity |

### Trade-offs
| Pros | Cons |
|------|------|
| Stateless, scalable design | Tokens not easily revoked before expiration |
| Works across domains | Token size increases header size |
| No server-side session storage | No built-in refresh token mechanism |
| Industry standard | Requires HTTPS in production |

### Implementation Details
```javascript
// Password hashing
bcrypt.hash(password, 10)  // 10 rounds

// Token generation
jwt.sign(payload, SECRET, { expiresIn: '7d' })

// Token verification
jwt.verify(token, SECRET)
```

### Mitigation
- **Short expiration:** 7 days limits exposure window
- **HTTPS only:** Enforced in production
- **Token refresh:** Could implement refresh tokens for enhanced security
- **Blacklisting:** Could add token blacklist for logout if needed

---

## 3. AI Integration: Google Gemini 2.5 Flash

### Why Gemini 2.5 Flash
1. **Context Window** - 1M tokens context window sufficient for hour long meeting transcripts.

2. **Cost-Effective** - Significantly cheaper than GPT-4; 1000x tokens ~$0.075 (vs GPT-4: $30)

3. **JSON Native Output** - `responseMimeType: "application/json"` ensures validated JSON without parsing errors.

4. **System Instructions** - Precise control over output via system prompts; consistent formatting.

5. **Sufficient Quality** - Excellent for structured extraction tasks; meets requirements without unnecessary cost.

6. **Fast** - Flash model optimized for speed without sacrificing quality for this use case.

### Alternatives Considered
| Model | Reason Not Chosen |
|-------|-------------------|
| GPT-4 | 400x more expensive; marginal quality gain for this task |
| Claude 3 Opus | 3x more expensive; similar quality to Gemini |
| Local LLM (Llama) | Requires infrastructure investment; self-hosting complexity |
| Mistral | Less structured output support; no native JSON mode |

### Trade-offs
| Pros | Cons |
|------|------|
| Cost-effective | May hit token limits for very long transcripts (>30k tokens) |
| Fast inference | No real-time streaming support needed |
| JSON native support | Less creative/nuanced than larger models |
| Good for extraction | Not ideal for open-ended generation |

### Prompt Strategy
```javascript
const systemPrompt = `
You are an expert project operations analyzer.

Extract:
- summaries
- action items
- decisions
- follow up suggestions

Every item MUST include timestamp citations from the transcript.
Return JSON in EXACTLY this structure:
{...}

Do not use any other field names.
`;
```

### Key Design Principles
1. **Role Assignment** - "Expert analyzer" sets context
2. **Explicit Requirements** - "MUST include citations" prevents hallucination
3. **JSON Schema** - Exact structure prevents format variations
4. **Temperature 0** - Deterministic outputs

---

## 4. External Integration: Telegram Bot API

### Why Telegram
1. **Simplicity** - HTTP-based API; no OAuth complexity; webhooks optional.

2. **User Familiar** - Most users already have Telegram; low friction to receive notifications.

3. **Reliability** - High message delivery rate (>99%); supports formatting and rich content.

4. **Cost** - Completely free tier; no SMS costs; no email infrastructure.

5. **Real-time** - Instant message delivery; no email delays or spam filters.

### Alternatives Considered
| Channel | Reason Not Chosen |
|---------|-------------------|
| Email (SMTP/SendGrid) | Spam filters; setup complexity; slower delivery |
| SMS (Twilio) | $0.01-0.05 per message; cost scales with users |
| Slack | Requires workspace installation; enterprise-only |
| Microsoft Teams | Similar limitations to Slack |
| WhatsApp | Expensive; requires business account approval |

### Trade-offs
| Pros | Cons |
|------|------|
| Free tier | Users need Telegram account |
| Instant delivery | No email/SMS fallback |
| Rich formatting | Limited to Telegram platform |
| Easy API | Bot token needs protection |

### Implementation
```javascript
// Cron job runs every minute
cron.schedule("* * * * *", async () => {
  const dueItems = await ActionItem.find({
    due_date: { $lt: new Date() },
    reminder_sent: { $ne: true }
  });

  for (const item of dueItems) {
    await bot.sendMessage(TELEGRAM_CHAT_ID, message);
    item.reminder_sent = true;
    await item.save();
  }
});
```

---

## 5. Project Structure Decision: Single index.js

### Why Single File
1. **Simplicity** - Small project; all routes in one place; easier to understand flow.

2. **No Over-Engineering** - Separate controller/router folders premature for this size.

3. **Faster Development** - Less file switching during development; quicker feature iteration.

4. **Clear Dependencies** - Easy to see what each route depends on.

### Alternatives Considered
| Structure | Reason Not Chosen |
|-----------|-------------------|
| MVC (Models/Views/Controllers) | Overkill for API-only project without views |
| Modular Controllers | Would split related code; harder to follow for this size |
| Plugins/Microservices | Excessive complexity; premature optimization |

### Trade-offs
| Pros | Cons |
|------|------|
| Simple to understand | Single file grows large (700+ lines) |
| Easy debugging | Harder to scale to large team |
| No circular dependencies | Less modular for reuse |
| Fast development | Testing is more integrated |

### Structure
```
project/
├── index.js              # Single Express app with all routes
├── database.js           # Mongoose schemas/models
├── utils/                # Shared utilities
├── validation/           # Zod schemas
├── schemas/              # AI output schemas
├── tests/                # Tests
└── logs/                 # Log files
```

### Mitigation
- **Comments:** Clear section headers in code
- **Validation:** Separate validation folder keeps schemas organized
- **Models:** Mongoose models in database.js for organization
- **Plan to refactor:** If project grows, split into controllers/routes

---

## 6. Validation Strategy: Zod

### Why Zod
1. **Type Safety** - Runtime type checking with TypeScript-like syntax.

2. **Error Messages** - User-friendly, descriptive validation errors.

3. **Composability** - Schemas can be combined and extended easily.

4. **No Build Step** - Works directly in Node.js; no compilation needed.

### Alternatives Considered
| Validator | Reason Not Chosen |
|-----------|-------------------|
| Joi | More complex syntax; Zod is simpler |
| express-validator | Less type-safe; more verbose |
| JSON Schema | Verbose; less developer-friendly |
| Hand-written validation | Error-prone; repetitive |

### Trade-offs
| Pros | Cons |
|------|------|
| Excellent DX | Runtime overhead (minimal) |
| Clear error messages | Parser creation on every request |
| Composable schemas | Learning curve for complex schemas |
| Type inference | Extra dependency |

### Implementation
```javascript
const CreateMeetingRequestSchema = z.object({
  title: z.string().min(1, "Meeting title is required"),
  participants: z.array(z.string().email()),
  meetingDate: z.string().refine(date => !isNaN(Date.parse(date))),
  transcript: z.array(TranscriptSchema).min(1)
});

// In middleware
schema.parse(data);  // Throws ZodError if invalid
```

---

## 7. Logging Strategy: Winston

### Why Winston
1. **Structured Logging** - JSON-friendly format for log aggregation.

2. **Multiple Transports** - Console + file output simultaneously.

3. **Log Levels** - Hierarchy: error, warn, info, debug.

4. **Rotation** - Automatic file rotation and cleanup.

5. **Correlation** - TraceID propagation across logs for request tracking.

### Alternatives Considered
| Logger | Reason Not Chosen |
|--------|-------------------|
| console.log | No structure; not suitable for production |
| Pino | Faster but Winston has better docs |
| Bunyan | Good but Winston more flexible |
| Morgan (for HTTP) | Only for HTTP logs; need more |

### Trade-offs
| Pros | Cons |
|------|------|
| Rich features | Slight performance overhead |
| Multiple outputs | Configuration complexity |
| Rotation support | More dependencies |
| Industry standard | Learning curve |

### Implementation
```javascript
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  ]
});
```

### TraceID Propagation
```javascript
const traceId = randomUUID();
logger.info('Request received', { traceId, method, path });
// Later in different function
logger.info('Processing complete', { traceId });
// Same traceId correlates logs across request lifecycle
```

---

## 8. Testing Framework: Vitest

### Why Vitest
1. **Fast** - Built on esbuild; much faster than Jest.

2. **Vite Native** - Uses same config as Vite projects; consistent setup.

3. **Compatible** - Jest-compatible API; easy migration path.

4. **Modern** - Built for modern Node.js/ESM workflows.

### Alternatives Considered
| Framework | Reason Not Chosen |
|-----------|-------------------|
| Jest | Slower; more configuration needed |
| Mocha + Chai | Less feature-rich; more setup |
| Tap | Small ecosystem; less documentation |

### Trade-offs
| Pros | Cons |
|------|------|
| Very fast | Smaller ecosystem than Jest |
| Modern | Less Stack Overflow answers |
| ESM support | Newer (less battle-tested) |
| Easy setup | |

---

## Decision Review

### When to Revisit
- **Database:** If data becomes highly relational, consider PostgreSQL
- **Auth:** If multi-tenant, consider OAuth2 implementation
- **AI:** If costs spike, evaluate local LLM options
- **Structure:** If team grows, refactor into modular structure
- **Logging:** If scale grows, integrate with log aggregation service (DataDog, Splunk)

### Future Improvements
- [ ] Add caching layer (Redis) for frequently accessed data
- [ ] Implement refresh token mechanism for auth
- [ ] Add API rate limiting
- [ ] Integrate with analytics platform
- [ ] Add webhook support for external integrations
- [ ] Implement request signing for security
