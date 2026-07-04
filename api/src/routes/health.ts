import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { redisClient } from '../db/redis';

const router = Router();

// GET /api/health - pings each datastore independently so a single failing
// dependency shows up clearly in the response instead of the whole request
// throwing. This is the fastest way to confirm docker-compose wired every
// service together correctly.
// Postgres isn't wired up yet — it comes back in Phase 3 with Prisma.
router.get('/', async (_req: Request, res: Response) => {
  const status: Record<'mongo' | 'redis', 'ok' | 'error'> = {
    mongo: 'ok',
    redis: 'ok',
  };

  try {
    if (mongoose.connection.readyState !== 1) throw new Error('not connected');
    await mongoose.connection.db!.admin().ping();
  } catch {
    status.mongo = 'error';
  }

  try {
    await redisClient.ping();
  } catch {
    status.redis = 'error';
  }

  const allOk = Object.values(status).every((s) => s === 'ok');
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', services: status });
});

export default router;
