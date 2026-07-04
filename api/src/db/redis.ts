import { createClient, RedisClientType } from 'redis';
import { env } from '../config/env';

export const redisClient: RedisClientType = createClient({ url: env.redisUrl });

// node-redis emits 'error' on connection loss/failure; without a listener
// Node treats it as an uncaught exception and crashes the process.
redisClient.on('error', (err) => {
  console.error('[redis] client error', err);
});

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
  console.log('[redis] connected');
}

export async function disconnectRedis(): Promise<void> {
  await redisClient.disconnect();
}
