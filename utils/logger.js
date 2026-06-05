import winston from "winston";
import { randomUUID } from "crypto";

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: () => new Date().toISOString() }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, traceId, stack }) => {
    const trace = traceId ? `[${traceId}] ` : "";
    if (level === "error" && stack) {
      return `${timestamp} ${level.toUpperCase().padEnd(7)} ${trace}${message}\n${stack}`;
    }
    return `${timestamp} ${level.toUpperCase().padEnd(7)} ${trace}${message}`;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ],
  exitOnError: process.env.NODE_ENV !== "test"
});

// Create a stream object for Morgan or Express logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Helper function to generate trace ID
export const getTraceId = () => randomUUID();

export default logger;
