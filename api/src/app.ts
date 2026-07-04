import express, { Express } from 'express';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import tripsRouter from './routes/trips';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/trips', tripsRouter);

  return app;
}
