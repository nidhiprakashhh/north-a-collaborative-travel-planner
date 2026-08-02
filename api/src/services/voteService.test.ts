import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { computeVoteTallies } from './voteService';
import { Vote } from '../models/Vote';
import { resetDatabase, connectTestMongo, disconnectTestMongo } from '../test/setup';

describe('voteService', () => {
  beforeAll(connectTestMongo);
  afterAll(disconnectTestMongo);
  beforeEach(resetDatabase);

  it('returns an empty tally when no votes exist', async () => {
    const tallies = await computeVoteTallies('trip-1');
    expect(tallies).toEqual({});
  });

  it('counts votes per destination, scoped to the given trip', async () => {
    await Vote.create([
      { tripId: 'trip-1', userId: 'user-a', destination: 'Tokyo' },
      { tripId: 'trip-1', userId: 'user-b', destination: 'Tokyo' },
      { tripId: 'trip-1', userId: 'user-c', destination: 'Osaka' },
      // Different trip - must not leak into trip-1's tally.
      { tripId: 'trip-2', userId: 'user-a', destination: 'Kyoto' },
    ]);

    const tallies = await computeVoteTallies('trip-1');
    expect(tallies).toEqual({ Tokyo: 2, Osaka: 1 });
  });

  it('counts a changed vote once, not twice, for the same user', async () => {
    // Mirrors the socket handler's findOneAndUpdate({tripId, userId}, ..., {upsert: true}) -
    // a user re-voting replaces their vote rather than adding a second one.
    await Vote.findOneAndUpdate(
      { tripId: 'trip-1', userId: 'user-a' },
      { $set: { destination: 'Tokyo' } },
      { upsert: true },
    );
    await Vote.findOneAndUpdate(
      { tripId: 'trip-1', userId: 'user-a' },
      { $set: { destination: 'Osaka' } },
      { upsert: true },
    );

    const tallies = await computeVoteTallies('trip-1');
    expect(tallies).toEqual({ Osaka: 1 });
  });
});
