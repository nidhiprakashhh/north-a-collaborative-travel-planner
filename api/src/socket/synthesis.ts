import { redisClient } from '../db/redis';
import { synthesizeItinerary } from '../services/synthesisService';
import { AppServer } from './types';

const DEBOUNCE_MS = 3000;
const LOCK_TTL_SECONDS = 10;

function lastUpdateKey(tripId: string): string {
  return `synthesis:last_update:${tripId}`;
}

function lockKey(tripId: string): string {
  return `synthesis:lock:${tripId}`;
}

// Called on every preference_update. Records this update's timestamp in
// Redis, then waits out the debounce window before checking whether a newer
// update has arrived since — if so, that update's own timer will fire
// instead, so this one bails out silently.
export async function scheduleSynthesis(io: AppServer, tripId: string): Promise<void> {
  const scheduledAt = Date.now();
  await redisClient.set(lastUpdateKey(tripId), scheduledAt.toString());

  setTimeout(() => {
    checkAndTriggerSynthesis(io, tripId, scheduledAt).catch((err) => {
      console.error('[synthesis] debounce check failed', err);
    });
  }, DEBOUNCE_MS);
}

async function checkAndTriggerSynthesis(io: AppServer, tripId: string, scheduledAt: number): Promise<void> {
  const stored = await redisClient.get(lastUpdateKey(tripId));
  if (!stored || Number(stored) !== scheduledAt) {
    // A newer preference_update arrived after this one was scheduled.
    return;
  }

  // The lock is what makes this safe under horizontal scaling: if multiple
  // api instances are running, only the one that wins the NX set actually
  // triggers synthesis for this trip.
  const lockAcquired = await redisClient.set(lockKey(tripId), '1', { NX: true, EX: LOCK_TTL_SECONDS });
  if (!lockAcquired) {
    return;
  }

  // Emitted before the (multi-second) LLM call so the frontend can show a
  // "synthesizing..." state immediately, not just when the result arrives.
  io.to(tripId).emit('synthesis_started', { tripId });

  try {
    const itinerary = await synthesizeItinerary(tripId);
    io.to(tripId).emit('itinerary_updated', itinerary);
  } catch (err) {
    console.error(`[synthesis] failed for trip ${tripId}`, err);
    // Same bug as the manual /synthesize REST path had: synthesis_started
    // was broadcast to the whole room, so a silent failure here left every
    // connected client's socket-driven "synthesizing..." state stuck
    // forever instead of clearing.
    io.to(tripId).emit('error_message', { message: 'Failed to synthesize itinerary' });
  }
}
