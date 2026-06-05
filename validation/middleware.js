import { randomUUID } from "crypto";
import { z } from "zod";

import { ZodError } from "zod";
// Error Response Type
export const ErrorResponseSchema = z.object({
    traceId: z.string(),
    success: z.literal(false),
    error: z.object({
        code: z.string(),
        message: z.string()
    })
});

// Success Response Type
export const SuccessResponseSchema = z.object({
    traceId: z.string(),
    success: z.literal(true),
    data: z.any()
});

/**
 * Creates a validation middleware for Express
 * @param {z.ZodTypeAny} schema - Zod schema to validate against
 * @param {string} target - What to validate: 'body', 'params', 'query', or 'all'
 * @returns {Function} Express middleware
 */
export const validate = (schema, target = "body") => {
    return (req, res, next) => {
        const traceId = randomUUID();
        const dataToValidate = target === "body" ? req.body :
            target === "params" ? req.params :
                target === "query" ? req.query :
                    { ...req.body, ...req.params, ...req.query };

        try {
            schema.parse(dataToValidate);
            // Attach traceId to request for potential logging
            req.traceId = traceId;
            next();
        } catch (error) {
            // if (error && error.errors && error.errors instanceof Array) {
            //     const errors = error.errors.map(e => ({
            //         path: e.path.join("."),
            //         message: e.message
            //     }));
            //
            //     return res.status(400).json({
            //         traceId,
            //         success: false,
            //         error: {
            //             code: "VALIDATION_ERROR",
            //             message: errors[0]?.message || "Validation failed"
            //         }
            //     });
            // }

            if (error instanceof ZodError) {
                const errors = error.issues.map(issue => ({
                    path: issue.path.join("."),
                    message: issue.message
                }));

                return res.status(400).json({
                    traceId,
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: errors[0]?.message || "Validation failed"
                    }
                });
            }

            // Unexpected error (non-Zod error)
            return res.status(500).json({
                traceId,
                success: false,
                error: {
                    code: "INTERNAL_ERROR",
                    message: error?.message || "An unexpected error occurred"
                }
            });
        }
    };
};

/**
 * Validates response data against a Zod schema
 * @param {z.ZodTypeAny} schema - Zod schema to validate against
 * @returns {Function} Express middleware that validates response
 */
export const validateResponse = (schema) => {
    return (req, res) => {
        const originalJson = res.json.bind(res);
        const traceId = req.traceId || randomUUID();

        res.json = (data) => {
            try {
                // Combine with traceId and success flag
                const responseWithMeta = {
                    traceId,
                    success: true,
                    data
                };
                schema.parse(responseWithMeta);
                return originalJson(data);
            } catch (error) {
                console.error("Response validation failed:", error);
                return originalJson({
                    traceId,
                    success: false,
                    error: {
                        code: "RESPONSE_VALIDATION_ERROR",
                        message: "Response format validation failed"
                    }
                });
            }
        };

        next?.();
    };
};
