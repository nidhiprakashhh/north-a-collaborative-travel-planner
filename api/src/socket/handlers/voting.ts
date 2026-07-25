import { Vote } from '../../models/Vote';
import { computeVoteTallies } from '../../services/voteService';
import { AppServer, AppSocket, VoteCastPayload } from '../types';

export function registerVotingHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('vote_cast', async ({ tripId, destination }: VoteCastPayload) => {
    if (!tripId || !destination) {
      socket.emit('error_message', { message: 'tripId and destination are required' });
      return;
    }

    try {
      await Vote.findOneAndUpdate(
        { tripId, userId: socket.data.userId },
        { $set: { destination } },
        { upsert: true, new: true },
      );

      const tallies = await computeVoteTallies(tripId);
      io.to(tripId).emit('vote_tally_update', { tripId, tallies });
    } catch (err) {
      console.error('[socket] vote_cast failed', err);
      socket.emit('error_message', { message: 'Failed to cast vote' });
    }
  });
}
