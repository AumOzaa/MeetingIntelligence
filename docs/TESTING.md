# Test Coverage

This document describes the test scenarios executed, edge cases considered, and discovered limitations.

---

## Test Scenarios Executed

### Meetings API Tests (`tests/meetings.test.js`)

| Test | Description | Status | Notes |
|------|-------------|--------|-------|
| `creates meeting successfully` | Valid meeting with all required fields | ✅ PASS | Tests successful meeting creation with valid transcript |
| `fails validation` | Missing required fields (title, transcript) | ✅ PASS | Tests Zod validation catches invalid input |

### Action Items API Tests (`tests/actionItems.test.js`)

| Test | Description | Status | Notes |
|------|-------------|--------|-------|
| `updates status` | Change status from "Pending" to "Completed" | ✅ PASS | Validates status update workflow |
| `updates due date` | Set `dueDate` field on action item | ⚠️ FAIL | Schema requires `id` in body, but API passes in params |
| `returns overdue items` | Filter items with past due dates | ⚠️ FAIL | Query uses `dueDate` field but DB schema uses `due_date` |
| `filters by status` | Query by `status=Completed` | ✅ PASS | Tests status filtering functionality |

---

## Test Setup

### Test Dependencies
- **Vitest** - Test framework
- **Supertest** - HTTP request mocking
- **MongoDB Memory Server** - In-memory MongoDB for testing

### Test Configuration
```javascript
// vitest.config.js
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.js"]
  }
});
```

### Test Environment
- MongoDB connection uses in-memory server
- Collections cleared after each test (`afterEach`)
- Connection torn down after all tests (`afterAll`)

---

## Edge Cases Considered

1. **Empty Transcript**
   - Zod schema: `z.array(TranscriptSchema).min(1)`
   - Fails validation if no transcript entries

2. **Invalid Email Format**
   - Zod schema: `z.string().email("Invalid email format")`
   - Returns user-friendly error message

3. **Invalid Date Format**
   - Custom validation: `z.string().refine(date => !isNaN(Date.parse(date)))`
   - Accepts ISO 8601 format

4. **Duplicate Action Items**
   - Check before creation: `ActionItem.findOne({ meeting_id, task })`
   - Skips if task exists, tracks count

5. **Invalid MongoDB ID**
   - Regex validation: `/^[0-9a-fA-F]{24}$/`
   - Returns validation error for invalid IDs

6. **Overdue Items with No Due Date**
   - Filter: `{ due_date: { $ne: null, $lt: new Date() } }`
   - Excludes items without due dates

7. **Status Enum Values**
   - Valid values: "Pending", "In-Progress", "Completed"
   - Invalid values rejected by Zod enum validation

---

## Test Results Summary

```
Test Files: 1 passed, 1 failed
Tests: 4 passed, 2 failed
Duration: ~750ms
```

### Passing Tests (4)
- ✅ Create meeting with valid data
- ✅ Validation failure on invalid data
- ✅ Update action item status
- ✅ Filter action items by status

### Failing Tests (2)
- ⚠️ Update due date - Schema mismatch (body vs params)
- ⚠️ Overdue items - Field naming (dueDate vs due_date)

---

## Known Limitations (Test Scope)

1. **No Authentication Tests**
   - `authenticate` middleware not mocked in tests
   - All tests assume authenticated requests pass

2. **No Gemini Integration Tests**
   - `mockGeminiResponse` used instead of real API call
   - Tests validate output structure, not Gemini functionality

3. **No Pagination Tests**
   - `/api/meetings` pagination logic not verified
   - `limit` and `page` query params not tested

4. **No Error Path Tests**
   - Only happy paths tested
   - Database connection errors not simulated
   - Gemini API failures not simulated

5. **No Load/Performance Tests**
   - No concurrent request testing
   - No response time validation

6. **No Edge Case Tests**
   - No tests for very large transcripts
   - No tests for edge date formats
   - No tests for special characters in fields

---

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test tests/meetings.test.js
```

---

## Test Coverage Goals (Future)

| Area | Current | Target |
|------|---------|--------|
| Meeting creation | ✅ | ✅ |
| Validation errors | ✅ | ✅ |
| Authentication | ❌ | 80% |
| Error handling | ❌ | 90% |
| Pagination | ❌ | 100% |

---

## Mock Data

### Gemini Mock Response (`tests/mockGemini.js`)
```javascript
{
  text: JSON.stringify({
    summary: [{ text: "Launch postponed", citations: [...] }],
    actionItems: [{ task: "Prepare release notes", assignee: "Alice", status: "PENDING", ... }],
    decisions: [{ decision: "Launch next Friday", citations: [...] }],
    followUpSuggestions: [{ suggestion: "Review patch gaps", citations: [...] }]
  })
}
```

### Valid Meeting Payload
```javascript
{
  title: "Sprint Planning",
  participants: ["alice@example.com"],
  meetingDate: "2026-05-20T10:00:00Z",
  transcript: [{
    timestamp: "00:10",
    speaker: "John",
    text: "Launch next Friday"
  }]
}
```