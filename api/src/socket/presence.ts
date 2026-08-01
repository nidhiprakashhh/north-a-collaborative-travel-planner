import { redisClient } from '../db/redis';
import { PresenceUser } from './types';

// Backed by a Redis hash per trip (socketId -> JSON-encoded PresenceUser)
// rather than an in-memory Map, so presence is consistent across multiple
// API instances behind the Socket.io Redis adapter — a plain in-process Map
// would only ever reflect who's connected to *this* instance. Redis auto-
// deletes a hash once its last field is removed, so there's no separate
// "trip has no one left" cleanup step needed, same as the old Map behavior.
function presenceKey(tripId: string): string {
  return `presence:trip:${tripId}`;
}

export async function addPresence(tripId: string, socketId: string, user: PresenceUser): Promise<void> {
  await redisClient.hSet(presenceKey(tripId), socketId, JSON.stringify(user));
}

export async function removePresence(tripId: string, socketId: string): Promise<void> {
  await redisClient.hDel(presenceKey(tripId), socketId);
}

export async function getPresence(tripId: string): Promise<PresenceUser[]> {
  const raw = await redisClient.hGetAll(presenceKey(tripId));
  return Object.values(raw).map((value) => JSON.parse(value) as PresenceUser);
}

export async function updateEditingField(tripId: string, socketId: string, field: string | undefined): Promise<void> {
  const key = presenceKey(tripId);
  const raw = await redisClient.hGet(key, socketId);
  if (!raw) return;

  const user = JSON.parse(raw) as PresenceUser;
  user.editingField = field;
  await redisClient.hSet(key, socketId, JSON.stringify(user));
}
