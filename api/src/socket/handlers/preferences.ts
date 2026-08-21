import { Preference } from '../../models/Preference';
import { scheduleSynthesis } from '../synthesis';
import { AppServer, AppSocket, PreferenceUpdatePayload } from '../types';

export function registerPreferenceHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('preference_update', async (payload: PreferenceUpdatePayload) => {
    const { tripId, ...updates } = payload;

    if (!tripId) {
      socket.emit('error_message', { message: 'tripId is required' });
      return;
    }

    try {
      const preference = await Preference.findOneAndUpdate(
        { tripId, userId: socket.data.userId },
        { $set: updates },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      // Broadcast to the whole room, including the sender, so every client
      // renders the canonical persisted document rather than its own draft.
      io.to(tripId).emit('preference_broadcast', {
        tripId,
        userId: socket.data.userId,
        preference: {
          destinations: preference.destinations,
          availableDates: preference.availableDates,
          budgetPerDay: preference.budgetPerDay,
          activityTypes: preference.activityTypes,
          mustSee: preference.mustSee,
          considerPlaces: preference.considerPlaces,
          dealbreakers: preference.dealbreakers,
          updatedAt: preference.updatedAt,
        },
      });

      await scheduleSynthesis(io, tripId);
    } catch (err) {
      console.error('[socket] preference_update failed', err);
      socket.emit('error_message', { message: 'Failed to save preference update' });
    }
  });
}
