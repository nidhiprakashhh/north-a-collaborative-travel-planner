import { createApp } from './app';
import { env } from './config/env';
import { connectPostgres, disconnectPostgres } from './db/postgres';
import { connectMongo, disconnectMongo } from './db/mongo';
import { connectRedis, disconnectRedis } from './db/redis';
import { initializeSocket } from './socket';

async function main(): Promise<void> {
  await Promise.all([connectPostgres(), connectMongo(), connectRedis()]);

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] listening on port ${env.port}`);
  });

  // Socket.io attaches to the same underlying http.Server as Express —
  // one process, one port, HTTP and WebSocket traffic share it.
  const io = await initializeSocket(server);
  // Lets REST controllers (e.g. the manual /synthesize trigger) reach the
  // socket server to broadcast, via req.app.get('io').
  app.set('io', io);

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
