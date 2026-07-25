import path from 'path';
import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/env';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import tripsRouter from './routes/trips';

export function createApp(): Express {
  const app = express();

  // Socket.io's CORS (socket/index.ts) only covers WebSocket upgrades —
  // plain REST calls (register/login/trips/etc.) need their own CORS
  // middleware, or the browser blocks the response before JS ever sees it.
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());

  // Serves the Socket.io manual test page (public/socket-test.html) until
  // the real frontend exists. Safe to keep around after that too.
  app.use(express.static(path.join(__dirname, '../public')));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/trips', tripsRouter);

  return app;
}
