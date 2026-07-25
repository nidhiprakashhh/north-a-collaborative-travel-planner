import { Vote } from '../models/Vote';

export async function computeVoteTallies(tripId: string): Promise<Record<string, number>> {
  const results = await Vote.aggregate<{ _id: string; count: number }>([
    { $match: { tripId } },
    { $group: { _id: '$destination', count: { $sum: 1 } } },
  ]);

  return Object.fromEntries(results.map((r) => [r._id, r.count]));
}
