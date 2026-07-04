import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { prisma } from '../db/postgres';
import { redisClient } from '../db/redis';

const router = Router();

// GET /api/health - pings each datastore independently so a single failing
// dependency shows up clearly in the response instead of the whole request
// throwing. This is the fastest way to confirm docker-compose wired every
// service together correctly.
router.get('/', async (_req: Request, res: Response) => {
  const status: Record<'postgres' | 'mongo' | 'redis', 'ok' | 'error'> = {
    postgres: 'ok',
    mongo: 'ok',
    redis: 'ok',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    status.postgres = 'error';
  }

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
