import { describe, it, expect, beforeEach } from 'vitest';
import { registerUser, loginUser, getUserById } from './authService';
import { prisma } from '../db/postgres';
import { HttpError } from '../utils/httpError';
import { resetDatabase } from '../test/setup';

describe('authService', () => {
  beforeEach(resetDatabase);

  describe('registerUser', () => {
    it('creates a user and returns a token plus a user object with no password hash', async () => {
      const result = await registerUser({ email: 'alice@example.com', password: 'secret123', name: 'Alice' });

      expect(result.token).toBeTruthy();
      expect(result.user).toEqual({ id: expect.any(String), email: 'alice@example.com', name: 'Alice' });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('hashes the password rather than storing it as plaintext', async () => {
      await registerUser({ email: 'alice@example.com', password: 'secret123', name: 'Alice' });

      const row = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@example.com' } });
      expect(row.passwordHash).not.toBe('secret123');
      expect(row.passwordHash.length).toBeGreaterThan(20);
    });

    it('rejects a duplicate email', async () => {
      await registerUser({ email: 'alice@example.com', password: 'secret123', name: 'Alice' });

      await expect(
        registerUser({ email: 'alice@example.com', password: 'different-password', name: 'Someone Else' }),
      ).rejects.toThrow(HttpError);
    });
  });

  describe('loginUser', () => {
    beforeEach(async () => {
      await registerUser({ email: 'alice@example.com', password: 'secret123', name: 'Alice' });
    });

    it('succeeds with correct credentials', async () => {
      const result = await loginUser({ email: 'alice@example.com', password: 'secret123' });
      expect(result.user.email).toBe('alice@example.com');
      expect(result.token).toBeTruthy();
    });

    it('rejects a wrong password', async () => {
      await expect(loginUser({ email: 'alice@example.com', password: 'wrong-password' })).rejects.toThrow(HttpError);
    });

    it('rejects a nonexistent email with the same error as a wrong password', async () => {
      // Distinguishing these would let an attacker enumerate registered
      // emails by observing which error comes back.
      const wrongPassword = await loginUser({ email: 'alice@example.com', password: 'wrong' }).catch((e) => e);
      const noSuchUser = await loginUser({ email: 'nobody@example.com', password: 'wrong' }).catch((e) => e);

      expect(wrongPassword).toBeInstanceOf(HttpError);
      expect(noSuchUser).toBeInstanceOf(HttpError);
      expect(wrongPassword.statusCode).toBe(noSuchUser.statusCode);
      expect(wrongPassword.message).toBe(noSuchUser.message);
    });
  });

  describe('getUserById', () => {
    it('returns the user for a valid id', async () => {
      const { user } = await registerUser({ email: 'alice@example.com', password: 'secret123', name: 'Alice' });
      const found = await getUserById(user.id);
      expect(found).toEqual(user);
    });

    it('returns null for a nonexistent id', async () => {
      const found = await getUserById('00000000-0000-0000-0000-000000000000');
      expect(found).toBeNull();
    });
  });
});
