import { editItineraryDay } from '../../services/synthesisService';
import { HttpError } from '../../utils/httpError';
import { AppServer, AppSocket, ItineraryEditPayload } from '../types';

// A manual edit to one day of the itinerary — broadcasts itinerary_updated,
// the exact same event a fresh LLM synthesis run broadcasts, so the
// frontend doesn't need to know or care which kind of update it's showing.
export function registerItineraryEditHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('itinerary_edit', async (payload: ItineraryEditPayload) => {
    const { tripId, dayIndex, activities, accommodation, cost } = payload;

    if (!tripId || dayIndex === undefined) {
      socket.emit('error_message', { message: 'tripId and dayIndex are required' });
      return;
    }

    try {
      const itinerary = await editItineraryDay(tripId, socket.data.userId, dayIndex, {
        activities,
        accommodation,
        cost,
      });
      io.to(tripId).emit('itinerary_updated', itinerary);
    } catch (err) {
      const message = err instanceof HttpError ? err.message : 'Failed to save the edit';
      console.error('[socket] itinerary_edit failed', err);
      socket.emit('error_message', { message });
    }
  });
}
