import mongoose from 'mongoose';
import logger from './logger';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    logger.warn('No MONGODB_URI provided. Continuing without database connectivity.');
    return;
  }

  const connectWithRetry = async (retries = 5, delay = 5000): Promise<boolean> => {
    try {
      await mongoose.connect(uri, {
        connectTimeoutMS: 60000,
        serverSelectionTimeoutMS: 60000,
      });
      logger.info('MongoDB connected');
      return true;
    } catch (error) {
      if (retries <= 0) {
        logger.error('MongoDB connection failed after multiple attempts:', error);
        logger.warn('Continuing without MongoDB. Duplicate-comment tracking will be in-memory only.');
        return false;
      }

      logger.warn(
        `MongoDB connection attempt failed. Retrying in ${delay / 1000} seconds... (${retries} attempts remaining)`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectWithRetry(retries - 1, delay);
    }
  };

  return connectWithRetry();
};
