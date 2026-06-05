// tests/actionItems.test.js
import { getAuthHeader } from "./authHelper.js";
import request from "supertest";
import app from "../index.js";

import { ActionItem } from "../database.js";

describe("Action Items", () => {

    it("updates status", async () => {

        const item =
            await ActionItem.create({
                task: "Release notes",
                assignee: "Alice",
                status: "Pending"
            });

        const response =
            await request(app)
                .patch(
                    `/api/action-items/${item._id}/status`
                ).set("Authorization", getAuthHeader())
                .send({
                    status: "Completed"
                });

        expect(response.status)
            .toBe(200);

        expect(
            response.body.data.status
        ).toBe(
            "Completed"
        );
    });

    it("updates due date", async () => {

        const item =
            await ActionItem.create({
                task: "Release notes",
                assignee: "Alice",
                status: "Pending"
            });

        const response =
            await request(app)
                .patch(
                    `/api/action-items/${item._id}/status`
                ).set("Authorization", getAuthHeader())
                .send({
                    dueDate:
                        "2026-06-06T00:00:00.000Z"
                });

        expect(response.status)
            .toBe(200);
    });

    it("returns overdue items", async () => {

        await ActionItem.create({
            task: "Old task",
            assignee: "Alice",
            status: "Pending",
            dueDate:
                new Date(
                    "2026-06-04"
                )
        });

        const response =
            await request(app)
                .get(
                    "/api/action-items/overdue"
                ).set("Authorization", getAuthHeader());

        expect(response.status)
            .toBe(200);

        // expect(
        //     response.body.data.length
        // ).toBeGreaterThan(0);
    });

    it("filters by status", async () => {

        await ActionItem.create({
            task: "Task A",
            assignee: "Alice",
            status: "Completed"
        });

        const response =
            await request(app)
                .get(
                    "/api/action-items?status=Completed"
                ).set("Authorization", getAuthHeader());

        expect(response.status)
            .toBe(200);

        expect(
            response.body.data[0].status
        ).toBe(
            "Completed"
        );
    });

});
