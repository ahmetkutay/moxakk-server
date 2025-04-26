import express from 'express';
import dotenv from 'dotenv';
import { setupMiddleware } from './config/config';
import connectDB from './config/db';
import matchRouter from './routes/match';
import { errorHandler } from './utils/error-handler';
import logger from './utils/logger';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

setupMiddleware(app);

connectDB().catch((err) => {
  logger.error(`Database connection error: ${err.message}`);
  process.exit(1);
});

app.use('/api', matchRouter);

// Error handling middleware
app.use(errorHandler);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      type: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`,
    },
  });
});

const server = app.listen(port, () => {
  logger.info(`Server is running at http://localhost:${port}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  console.error(err);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  console.error(err);
  // Close server & exit process
  server.close(() => process.exit(1));
});
