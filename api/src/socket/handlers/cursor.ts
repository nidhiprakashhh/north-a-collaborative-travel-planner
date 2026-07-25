import { updateEditingField } from '../presence';
import { AppSocket, CursorUpdatePayload } from '../types';

export function registerCursorHandlers(socket: AppSocket): void {
  socket.on('cursor_update', ({ tripId, field }: CursorUpdatePayload) => {
    if (!tripId) return;

    updateEditingField(tripId, socket.id, field);
    socket.to(tripId).emit('cursor_broadcast', { tripId, userId: socket.data.userId, field });
  });
}
