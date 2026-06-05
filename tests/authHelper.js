// tests/authHelper.js
import jwt from "jsonwebtoken";

export function getAuthHeader() {
    const token = jwt.sign(
        {
            userId: "test-user-id",
            email: "test@example.com"
        },
        process.env.JWT_SECRET || "test-secret",
        { expiresIn: "1h" }
    );

    return `Bearer ${token}`;
}
