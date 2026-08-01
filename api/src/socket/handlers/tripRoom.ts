import { prisma } from '../../db/postgres';
import { addPresence, getPresence, removePresence } from '../presence';
import { AppSocket } from '../types';

async function leaveTrip(socket: AppSocket, tripId: string): Promise<void> {
  await removePresence(tripId, socket.id);
  socket.leave(tripId);
  socket.to(tripId).emit('user_left', { tripId, userId: socket.data.userId });
  if (socket.data.currentTripId === tripId) {
    socket.data.currentTripId = undefined;
  }
}

export function registerTripRoomHandlers(socket: AppSocket): void {
  socket.on('join_trip', async ({ tripId }, ack) => {
    try {
      const membership = await prisma.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId: socket.data.userId } },
      });

      if (!membership) {
        socket.emit('error_message', { message: 'You are not a member of this trip' });
        ack?.({ ok: false, error: 'You are not a member of this trip' });
        return;
      }

      socket.join(tripId);
      socket.data.currentTripId = tripId;

      const presenceUser = { userId: socket.data.userId, name: socket.data.name };
      await addPresence(tripId, socket.id, presenceUser);

      // Sent only to the joiner so they can render everyone already present.
      socket.emit('presence_state', { tripId, users: await getPresence(tripId) });
      // Broadcast to everyone else already in the room.
      socket.to(tripId).emit('user_joined', { tripId, user: presenceUser });
      // The client waits for this ack before allowing preference_update /
      // vote_cast / cursor_update — otherwise those can reach the server
      // (and get broadcast to the room) before this socket has actually
      // joined it, so the sender never sees its own update come back.
      ack?.({ ok: true });
    } catch (err) {
      console.error('[socket] join_trip failed', err);
      socket.emit('error_message', { message: 'Failed to join trip' });
      ack?.({ ok: false, error: 'Failed to join trip' });
    }
  });

  socket.on('leave_trip', ({ tripId }) => {
    leaveTrip(socket, tripId).catch((err) => console.error('[socket] leave_trip failed', err));
  });

  socket.on('disconnect', () => {
    if (socket.data.currentTripId) {
      leaveTrip(socket, socket.data.currentTripId).catch((err) =>
        console.error('[socket] disconnect cleanup failed', err),
      );
    }
  });
}
