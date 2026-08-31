import { CostItem, COST_CATEGORIES } from '../../models/CostItem';
import { AppServer, AppSocket, CostAddPayload, CostRemovePayload } from '../types';

// Same shape as consider.ts: a shared, discrete-per-item list, not tied to
// scheduleSynthesis — logging a cost shouldn't fire an LLM call.
export function registerCostHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('cost_add', async (payload: CostAddPayload) => {
    const { tripId, label, amount, category } = payload;

    if (!tripId || !label?.trim() || typeof amount !== 'number' || amount < 0) {
      socket.emit('error_message', { message: 'tripId, label, and a non-negative amount are required' });
      return;
    }
    if (category && !COST_CATEGORIES.includes(category)) {
      socket.emit('error_message', { message: `Invalid category: ${category}` });
      return;
    }

    try {
      const item = await CostItem.create({
        tripId,
        label: label.trim(),
        amount,
        category: category ?? 'other',
        addedBy: socket.data.userId,
      });

      io.to(tripId).emit('cost_added', {
        tripId,
        item: {
          id: item.id,
          label: item.label,
          amount: item.amount,
          category: item.category,
          addedBy: item.addedBy,
          createdAt: item.createdAt,
        },
      });
    } catch (err) {
      console.error('[socket] cost_add failed', err);
      socket.emit('error_message', { message: 'Failed to add cost' });
    }
  });

  socket.on('cost_remove', async ({ tripId, itemId }: CostRemovePayload) => {
    if (!tripId || !itemId) {
      socket.emit('error_message', { message: 'tripId and itemId are required' });
      return;
    }

    try {
      // Any trip member can remove any item, not just whoever added it —
      // same shared-collaborative-list model as consider/votes/preferences.
      await CostItem.deleteOne({ _id: itemId, tripId });
      io.to(tripId).emit('cost_removed', { tripId, itemId });
    } catch (err) {
      console.error('[socket] cost_remove failed', err);
      socket.emit('error_message', { message: 'Failed to remove cost' });
    }
  });
}
