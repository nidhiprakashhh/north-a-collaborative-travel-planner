import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env';
import { socketAuthMiddleware } from './authMiddleware';
import { registerTripRoomHandlers } from './handlers/tripRoom';
import { registerPreferenceHandlers } from './handlers/preferences';
import { registerVotingHandlers } from './handlers/voting';
import { registerCursorHandlers } from './handlers/cursor';
import { AppServer } from './types';

export function initializeSocket(httpServer: HttpServer): AppServer {
  const io: AppServer = new SocketIOServer(httpServer, {
    cors: {
      origin: env.corsOrigin,
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id} (user ${socket.data.userId})`);

    registerTripRoomHandlers(socket);
    registerPreferenceHandlers(io, socket);
    registerVotingHandlers(io, socket);
    registerCursorHandlers(socket);

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });

  return io;
}
