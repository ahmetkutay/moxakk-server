import winston from 'winston';

// Step 1: Define custom log level colors
const customColors = {
    error: 'bold red', // Bright red for errors
    warn: 'bold yellow', // Bright yellow for warnings
    info: 'bold green', // Green for general information
    http: 'bold cyan', // Cyan for HTTP-related logs
    debug: 'magenta', // Magenta for debugging
};

// Apply the custom colors to winston
winston.addColors(customColors);

// Step 2: Define re-usable log formats
const logFormat = winston.format.combine(
    winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
    winston.format.printf(({timestamp, level, message}) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

const colorizedFormat = winston.format.combine(
    winston.format.colorize({all: true}), // Enable color for all messages
    logFormat
);

// Step 3: Configure transports modularly
const transports = [
    new winston.transports.Console({
        format: colorizedFormat, // Apply colors to console logs
    }),
    new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error', // Only log errors to this file
        format: logFormat, // Use plain-text format
    }),
    new winston.transports.File({
        filename: 'logs/combined.log', // File for general logs
        format: logFormat,
    }),
];

// Step 4: Create the logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info', // Default log level (can be controlled via ENV)
    levels: winston.config.npm.levels, // Use default winston log levels
    transports,
});

// Step 5: Export the logger for use in other files
export default logger;