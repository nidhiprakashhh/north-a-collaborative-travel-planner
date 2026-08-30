import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '../config/env';
import { redisClient } from '../db/redis';
import { socketAuthMiddleware } from './authMiddleware';
import { registerTripRoomHandlers } from './handlers/tripRoom';
import { registerPreferenceHandlers } from './handlers/preferences';
import { registerVotingHandlers } from './handlers/voting';
import { registerCursorHandlers } from './handlers/cursor';
import { registerConsiderHandlers } from './handlers/consider';
import { registerItineraryEditHandlers } from './handlers/itineraryEdit';
import { AppServer } from './types';

export async function initializeSocket(httpServer: HttpServer): Promise<AppServer> {
  // The adapter needs two dedicated Redis connections (one publishes room
  // events, one subscribes) — a client in subscribe mode can't also issue
  // normal commands, so these can't be the shared `redisClient` used
  // elsewhere (vote tallies, the synthesis debounce lock). .duplicate()
  // copies connection config only, not event listeners, so each one needs
  // its own 'error' handler or a connection blip becomes an uncaught
  // exception and crashes the process, same reasoning as the base client.
  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();
  pubClient.on('error', (err) => console.error('[socket] redis pub client error', err));
  subClient.on('error', (err) => console.error('[socket] redis sub client error', err));
  await Promise.all([pubClient.connect(), subClient.connect()]);

  const io: AppServer = new SocketIOServer(httpServer, {
    cors: {
      origin: env.corsOrigin,
      credentials: true,
    },
    // Without this, io.to(tripId).emit(...) only reaches sockets connected
    // to *this* process — fine for a single instance, silently broken the
    // moment there's more than one. This makes room broadcasts work across
    // however many API instances end up running.
    adapter: createAdapter(pubClient, subClient),
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id} (user ${socket.data.userId})`);

    registerTripRoomHandlers(socket);
    registerPreferenceHandlers(io, socket);
    registerVotingHandlers(io, socket);
    registerCursorHandlers(socket);
    registerConsiderHandlers(io, socket);
    registerItineraryEditHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });

  return io;
}
