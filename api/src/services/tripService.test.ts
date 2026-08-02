import { describe, it, expect, beforeEach } from 'vitest';
import { createTrip, getTripById, joinTrip, listUserTrips } from './tripService';
import { registerUser } from './authService';
import { HttpError } from '../utils/httpError';
import { resetDatabase } from '../test/setup';

async function makeUser(email: string, name: string) {
  const { user } = await registerUser({ email, password: 'secret123', name });
  return user;
}

describe('tripService', () => {
  beforeEach(resetDatabase);

  describe('createTrip', () => {
    it('creates the trip and makes the creator the owner member', async () => {
      const owner = await makeUser('owner@example.com', 'Owner');
      const trip = await createTrip(owner.id, { name: 'Japan Trip' });

      expect(trip.name).toBe('Japan Trip');
      expect(trip.createdBy).toBe(owner.id);
      expect(trip.members).toHaveLength(1);
      expect(trip.members[0]).toMatchObject({ userId: owner.id, role: 'owner' });
    });

    it('generates an invite code', async () => {
      const owner = await makeUser('owner@example.com', 'Owner');
      const trip = await createTrip(owner.id, { name: 'Japan Trip' });
      expect(trip.inviteCode).toBeTruthy();
    });

    it('stores optional start/end dates when provided', async () => {
      const owner = await makeUser('owner@example.com', 'Owner');
      const trip = await createTrip(owner.id, { name: 'Japan Trip', startDate: '2026-09-01', endDate: '2026-09-03' });
      expect(trip.startDate?.toISOString().slice(0, 10)).toBe('2026-09-01');
      expect(trip.endDate?.toISOString().slice(0, 10)).toBe('2026-09-03');
    });
  });

  describe('getTripById', () => {
    it('returns the trip for a member', async () => {
      const owner = await makeUser('owner@example.com', 'Owner');
      const trip = await createTrip(owner.id, { name: 'Japan Trip' });

      const found = await getTripById(owner.id, trip.id);
      expect(found.id).toBe(trip.id);
    });

    it('throws 404 for a nonexistent trip', async () => {
      const owner = await makeUser('owner@example.com', 'Owner');
      await expect(getTripById(owner.id, '00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('throws 403 for a user who is not a member', async () => {
      const owner = await makeUser('owner@example.com', 'Owner');
      const outsider = await makeUser('outsider@example.com', 'Outsider');
      const trip = await createTrip(owner.id, { name: 'Japan Trip' });

      await expect(getTripById(outsider.id, trip.id)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('joinTrip', () => {
    it('adds the joiner as a member with the invite code', async () => {
      const owner = await makeUser('owner@example.com', 'Owner');
      const joiner = await makeUser('joiner@example.com', 'Joiner');
      const trip = await createTrip(owner.id, { name: 'Japan Trip' });

      const joined = await joinTrip(joiner.id, trip.id, trip.inviteCode);
      expect(joined.members).toHaveLength(2);
      expect(joined.members.find((m) => m.userId === joiner.id)).toMatchObject({ role: 'member' });
    });

    it('rejects a wrong invite code', async () => {
      const owner = await makeUser('owner@example.com', 'Owner');
      const joiner = await makeUser('joiner@example.com', 'Joiner');
      const trip = await createTrip(owner.id, { name: 'Japan Trip' });

      await expect(joinTrip(joiner.id, trip.id, 'WRONGCODE')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects joining a trip the user is already a member of', async () => {
      const owner = await makeUser('owner@example.com', 'Owner');
      const trip = await createTrip(owner.id, { name: 'Japan Trip' });

      await expect(joinTrip(owner.id, trip.id, trip.inviteCode)).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('listUserTrips', () => {
    it('returns only trips the user is a member of', async () => {
      const alice = await makeUser('alice@example.com', 'Alice');
      const bob = await makeUser('bob@example.com', 'Bob');
      const aliceTrip = await createTrip(alice.id, { name: "Alice's Trip" });
      await createTrip(bob.id, { name: "Bob's Trip" });

      const aliceTrips = await listUserTrips(alice.id);
      expect(aliceTrips.map((t) => t.id)).toEqual([aliceTrip.id]);
    });
  });
});

// Sanity check that HttpError itself carries a statusCode, since several
// assertions above rely on toMatchObject({ statusCode }) rather than
// asserting the error class directly.
describe('HttpError shape', () => {
  it('exposes statusCode and message', () => {
    const err = new HttpError(404, 'not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('not found');
  });
});
