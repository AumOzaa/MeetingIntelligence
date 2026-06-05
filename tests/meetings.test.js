import request from "supertest";
import { describe, it, expect, vi } from "vitest";

import app from "../index.js";

import { ai } from "../index.js";
import { mockGeminiResponse } from "./mockGemini.js";

describe("Meetings", () => {

    it("creates meeting successfully", async () => {

        vi.spyOn(
            ai.models,
            "generateContent"
        ).mockResolvedValue(
            mockGeminiResponse
        );

        const payload = {
            title: "Sprint Planning",
            participants: [
                "alice@example.com"
            ],
            meetingDate:
                "2026-05-20T10:00:00Z",
            transcript: [
                {
                    timestamp: "00:10",
                    speaker: "John",
                    text: "Launch next Friday"
                }
            ]
        };

        const response =
            await request(app)
                .post("/api/meetings")
                .send(payload);

        expect(response.status)
            .toBe(201);

        expect(response.body.success)
            .toBe(true);

        expect(response.body.traceId)
            .toBeDefined();
    });

    it("fails validation", async () => {

        const response =
            await request(app)
                .post("/api/meetings")
                .send({
                    transcript: [
                        {
                            timestamp:
                                "INVALID"
                        }
                    ]
                });

        expect(response.status)
            .toBe(400);

        expect(
            response.body.error.code
        ).toBe(
            "VALIDATION_ERROR"
        );
    });

});
