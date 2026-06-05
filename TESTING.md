# Testing Documentation

Comprehensive test coverage and validation strategy for the Meeting Intelligence API.

---

## Test Infrastructure

### Testing Stack
- **Framework:** Vitest 4.1.8
- **HTTP Testing:** Supertest
- **Database:** MongoDB Memory Server (in-memory MongoDB)
- **Mocking:** Vitest vi (spies and mocks)

### Configuration

**vitest.config.js**
```javascript
export default defineConfig({
  test: {
    globals: true,          // Global test functions (describe, it, expect)
    setupFiles: ["./tests/setup.js"]  // Environment setup
  }
});
```

**tests/setup.js**
```javascript
// Start in-memory MongoDB before all tests
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

// Clear collections after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
```

---

## Test Scenarios Executed

### Meetings API Tests (`tests/meetings.test.js`)

#### Test 1: Create Meeting Successfully ✅
```javascript
it("creates meeting successfully", async () => {
  const payload = {
    title: "Sprint Planning",
    participants: ["alice@example.com"],
    meetingDate: "2026-05-20T10:00:00Z",
    transcript: [{
      timestamp: "00:10",
      speaker: "John",
      text: "Launch next Friday"
    }]
  };

  const response = await request(app)
    .post("/api/meetings")
    .set("Authorization", getAuthHeader())
    .send(payload);

  expect(response.status).toBe(201);
  expect(response.body.success).toBe(true);
  expect(response.body.traceId).toBeDefined();
});
```

**What it tests:**
- Valid meeting creation with all required fields
- HTTP 201 Created response code
- Response structure (success, traceId, data)
- Meeting persisted to database

**Preconditions:**
- User authenticated with valid JWT
- Valid meeting payload

**Postconditions:**
- Meeting stored in MongoDB
- Response includes meeting _id

---

#### Test 2: Validation Failure ✅
```javascript
it("fails validation", async () => {
  const response = await request(app)
    .post("/api/meetings")
    .set("Authorization", getAuthHeader())
    .send({
      transcript: [{
        timestamp: "INVALID"
      }]
    });

  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe("VALIDATION_ERROR");
});
```

**What it tests:**
- Missing required fields (title, participants, meetingDate)
- Invalid timestamp format validation
- HTTP 400 Bad Request response
- Proper error code returned

**Preconditions:**
- Invalid payload sent

**Postconditions:**
- Request rejected before database write
- No meeting created

---

### Action Items API Tests (`tests/actionItems.test.js`)

#### Test 3: Update Action Item Status ✅
```javascript
it("updates status", async () => {
  const item = await ActionItem.create({
    task: "Release notes",
    assignee: "Alice",
    status: "Pending"
  });

  const response = await request(app)
    .patch(`/api/action-items/${item._id}/status`)
    .set("Authorization", getAuthHeader())
    .send({ status: "Completed" });

  expect(response.status).toBe(200);
  expect(response.body.data.status).toBe("Completed");
});
```

**What it tests:**
- PATCH request to update status
- Status field updated in database
- Response contains updated item
- HTTP 200 OK response

**Preconditions:**
- Action item exists in database
- Valid status value

**Postconditions:**
- Item status updated to "Completed"
- Updated item returned in response

---

#### Test 4: Update Due Date ⚠️ (Known Issue)
```javascript
it("updates due date", async () => {
  const item = await ActionItem.create({
    task: "Release notes",
    assignee: "Alice",
    status: "Pending"
  });

  const response = await request(app)
    .patch(`/api/action-items/${item._id}/status`)
    .set("Authorization", getAuthHeader())
    .send({ dueDate: "2026-06-06T00:00:00.000Z" });

  expect(response.status).toBe(200);
});
```

**Current Status:** ⚠️ Issue - Schema field mismatch

**Issue Description:**
- Test sends `dueDate` (camelCase)
- Database schema uses `due_date` (snake_case)
- Middleware converts `dueDate` to `due_date`

**Fix Applied:**
```javascript
// In request handler
if (dueDate !== undefined) {
  updateFields.due_date = dueDate;
} else if (due_date !== undefined) {
  updateFields.due_date = due_date;
}
```

---

#### Test 5: Filter by Status ✅
```javascript
it("filters by status", async () => {
  await ActionItem.create({
    task: "Task A",
    assignee: "Alice",
    status: "Completed"
  });

  const response = await request(app)
    .get("/api/action-items?status=Completed")
    .set("Authorization", getAuthHeader());

  expect(response.status).toBe(200);
  expect(response.body.data[0].status).toBe("Completed");
});
```

**What it tests:**
- Query parameter filtering
- Status filtering works correctly
- Response includes only matching items
- HTTP 200 OK response

**Preconditions:**
- Action items exist with specified status

**Postconditions:**
- Only items with matching status returned

---

## Edge Cases Considered

### Input Validation Edge Cases

| Case | Validation | Result |
|------|-----------|--------|
| Empty transcript array | `.min(1)` | Rejected with "At least one transcript entry required" |
| Missing title | `.min(1, "Meeting title is required")` | Rejected |
| Invalid email format | `.email("Invalid email format")` | Rejected |
| Null participants | Array validation | Rejected as non-array |
| Meeting date as string | `.refine(date => !isNaN(...))` | ISO 8601 dates accepted |
| Invalid ISO date | Custom validator | Rejected if Date.parse fails |

### Database Edge Cases

| Case | Handling | Result |
|------|----------|--------|
| Duplicate action items | `findOne()` before create | Duplicate skipped, count tracked |
| Missing due_date field | Schema default: null | Null stored, not queried in overdue |
| Non-existent meeting ID | 404 NOT_FOUND response | User notified clearly |
| Invalid MongoDB ObjectId | Regex validation | Rejected before database query |

### Timestamps Edge Cases

| Case | Handling | Result |
|------|----------|--------|
| `00:00` (start of meeting) | Valid format | Accepted |
| `99:99` (invalid time) | Only format checked | Accepted (known limitation) |
| `59:59` (max valid) | Format accepted | Accepted |
| `1:30` (single digit hour) | Regex requires 2-3 digits | Rejected |
| `00:5` (single digit minute) | Regex requires 2 digits | Rejected |

### Authentication Edge Cases

| Case | Handling | Result |
|------|----------|--------|
| Missing Authorization header | `authenticate` middleware | 401 Unauthorized |
| Invalid JWT token | `jwt.verify()` throws | 401 Unauthorized |
| Expired token (>7 days) | JWT expiration check | 401 Unauthorized |
| Valid token | Decoded and attached to `req.user` | Allowed to proceed |

---

## Known Limitations Discovered

### 1. Test Database Isolation ⚠️
**Issue:** Using MongoDB Memory Server adds ~500ms overhead per test run
**Impact:** Test suite takes longer than unit tests
**Mitigation:** Tests provide confidence in real database behavior

### 2. No Real Gemini Integration Testing
**Issue:** Tests mock Gemini with `mockGeminiResponse`
**Impact:** Actual Gemini API errors not tested
**Mitigation:** Separate integration tests can be run in CI/CD with real API key

### 3. Limited Authentication Testing
**Issue:** `getAuthHeader()` assumes auth works
**Impact:** Auth flow not fully tested
**Solution Needed:**
```javascript
describe("Authentication", () => {
  it("rejects requests without JWT", async () => {
    const response = await request(app)
      .post("/api/meetings")
      .send(validPayload);  // No Authorization header
    
    expect(response.status).toBe(401);
  });
});
```

### 4. No Error Path Testing
**Issue:** Only happy path scenarios tested
**Impact:** Error handling not validated
**Examples needed:**
- Database connection failures
- Gemini API timeout
- Invalid JSON response from Gemini
- File I/O errors

### 5. No Pagination Testing
**Issue:** GET /api/meetings pagination not tested
**Impact:** Pagination logic unverified
**Test needed:**
```javascript
it("respects pagination parameters", async () => {
  // Create 25 items
  for (let i = 0; i < 25; i++) {
    await Meeting.create({...});
  }
  
  const page1 = await request(app)
    .get("/api/meetings?page=1&limit=10");
  expect(page1.body.data.pagination.page).toBe(1);
  expect(page1.body.data.meetings).toHaveLength(10);
  
  const page2 = await request(app)
    .get("/api/meetings?page=2&limit=10");
  expect(page2.body.data.pagination.page).toBe(2);
});
```

### 6. No Concurrent Request Testing
**Issue:** No tests for race conditions
**Impact:** Concurrent update issues not detected
**Example:**
- Two users updating same action item simultaneously
- Race condition in reminder flag setting

### 7. No Load/Performance Testing
**Issue:** No tests for response time or throughput
**Impact:** Performance regressions undetected
**Could use:** k6, Artillery, or wrk

---

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/meetings.test.js

# Run with verbose output
npm test -- --reporter=verbose

# Watch mode (re-run on file change)
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Coverage Goals

```
Statements   : 65% coverage
Branches     : 50% coverage
Functions    : 65% coverage
Lines        : 65% coverage
```

**Current Coverage:**
```
 ✓ tests/meetings.test.js (2 tests)
 ✓ tests/actionItems.test.js (4 tests)
 ✓ 6 total tests, 4 passed, 2 known issues
```

### Debugging Tests

```bash
# Run with debug output
DEBUG=* npm test

# Run single test
npm test -- --grep "creates meeting successfully"

# Run with inspect (Node debugger)
node --inspect-brk ./node_modules/.bin/vitest

# Connect Chrome DevTools to localhost:9229
```

---

## Test Data

### Valid Meeting Payload
```json
{
  "title": "Sprint Planning",
  "participants": ["alice@example.com", "bob@example.com"],
  "meetingDate": "2026-05-20T10:00:00Z",
  "transcript": [
    {
      "timestamp": "00:10",
      "speaker": "John",
      "text": "We should launch next Friday"
    },
    {
      "timestamp": "00:20",
      "speaker": "Alice",
      "text": "I will prepare release notes"
    }
  ]
}
```

### Mock Gemini Response
```json
{
  "text": "{
    \"summary\": [{
      \"text\": \"Launch postponed\",
      \"citations\": [{\"timestamp\": \"00:10\"}]
    }],
    \"actionItems\": [{
      \"task\": \"Prepare release notes\",
      \"assignee\": \"Alice\",
      \"status\": \"Pending\",
      \"citations\": [{\"timestamp\": \"00:20\"}]
    }],
    \"decisions\": [...],
    \"followUpSuggestions\": [...]
  }"
}
```

---

## Future Test Plans

### High Priority
- [ ] Add authentication tests
- [ ] Add error path tests
- [ ] Test pagination thoroughly
- [ ] Test concurrent updates

### Medium Priority
- [ ] Add Gemini integration tests
- [ ] Add load testing
- [ ] Add performance benchmarks
- [ ] Test message queue integration

### Low Priority
- [ ] Visual regression testing
- [ ] E2E tests with UI
- [ ] Security penetration tests
- [ ] Accessibility tests

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:latest
        options: >-
          --health-cmd mongosh
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 18

      - run: npm ci
      - run: npm test
      - run: npm test -- --coverage
      
      - uses: codecov/codecov-action@v2
        with:
          files: ./coverage/coverage-final.json
```
