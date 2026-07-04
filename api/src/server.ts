import { createApp } from './app';
import { env } from './config/env';
import { connectPostgres, disconnectPostgres } from './db/postgres';
import { connectMongo, disconnectMongo } from './db/mongo';
import { connectRedis, disconnectRedis } from './db/redis';

async function main(): Promise<void> {
  await Promise.all([connectPostgres(), connectMongo(), connectRedis()]);

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] listening on port ${env.port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] received ${signal}, shutting down`);
    server.close();
    await Promise.all([disconnectPostgres(), disconnectMongo(), disconnectRedis()]);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
