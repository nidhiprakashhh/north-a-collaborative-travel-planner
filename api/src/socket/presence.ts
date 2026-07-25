import { PresenceUser } from './types';

// tripId -> socketId -> presence info. In-memory since this runs as a single
// Node process for now; a horizontally-scaled deployment would need this
// backed by Redis (and Socket.io's redis adapter for cross-instance rooms).
const tripPresence = new Map<string, Map<string, PresenceUser>>();

export function addPresence(tripId: string, socketId: string, user: PresenceUser): void {
  if (!tripPresence.has(tripId)) {
    tripPresence.set(tripId, new Map());
  }
  tripPresence.get(tripId)!.set(socketId, user);
}

export function removePresence(tripId: string, socketId: string): void {
  const sockets = tripPresence.get(tripId);
  sockets?.delete(socketId);
  if (sockets && sockets.size === 0) {
    tripPresence.delete(tripId);
  }
}

export function getPresence(tripId: string): PresenceUser[] {
  return Array.from(tripPresence.get(tripId)?.values() ?? []);
}

export function updateEditingField(tripId: string, socketId: string, field: string | undefined): void {
  const user = tripPresence.get(tripId)?.get(socketId);
  if (user) {
    user.editingField = field;
  }
}
