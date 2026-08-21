import { ConsiderIdea } from '../../models/ConsiderIdea';
import { AppServer, AppSocket, ConsiderAddPayload, ConsiderRemovePayload } from '../types';

// Not tied to scheduleSynthesis, same reasoning as preferences: adding
// ideas one at a time shouldn't fire an LLM call per idea. This list is
// picked up the next time synthesis actually runs, whenever that is.
export function registerConsiderHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('consider_add', async (payload: ConsiderAddPayload) => {
    const { tripId, name, link } = payload;

    if (!tripId || !name?.trim()) {
      socket.emit('error_message', { message: 'tripId and name are required' });
      return;
    }

    try {
      const idea = await ConsiderIdea.create({
        tripId,
        name: name.trim(),
        link,
        addedBy: socket.data.userId,
      });

      io.to(tripId).emit('consider_added', {
        tripId,
        idea: {
          id: idea.id,
          name: idea.name,
          link: idea.link,
          addedBy: idea.addedBy,
          createdAt: idea.createdAt,
        },
      });
    } catch (err) {
      console.error('[socket] consider_add failed', err);
      socket.emit('error_message', { message: 'Failed to add idea' });
    }
  });

  socket.on('consider_remove', async ({ tripId, ideaId }: ConsiderRemovePayload) => {
    if (!tripId || !ideaId) {
      socket.emit('error_message', { message: 'tripId and ideaId are required' });
      return;
    }

    try {
      // Any trip member can remove any idea, not just whoever added it —
      // shared collaborative list, same model as votes/preferences.
      await ConsiderIdea.deleteOne({ _id: ideaId, tripId });
      io.to(tripId).emit('consider_removed', { tripId, ideaId });
    } catch (err) {
      console.error('[socket] consider_remove failed', err);
      socket.emit('error_message', { message: 'Failed to remove idea' });
    }
  });
}
