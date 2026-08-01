import { verifyToken } from '../utils/jwt';
import { prisma } from '../db/postgres';
import { AppSocket } from './types';
import { AUTH_COOKIE_NAME, readCookieValue } from '../utils/cookies';

// Runs once per connection attempt, before 'connection' fires. The client is
// expected to connect with `io(url, { withCredentials: true })` so the
// httpOnly auth cookie rides along on the handshake request automatically —
// there's no token in `socket.handshake.auth` to read anymore, it has to be
// pulled out of the raw Cookie header instead.
export async function socketAuthMiddleware(
  socket: AppSocket,
  next: (err?: Error) => void,
): Promise<void> {
  const token = readCookieValue(socket.handshake.headers.cookie, AUTH_COOKIE_NAME);

  if (!token) {
    next(new Error('Missing auth token'));
    return;
  }

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { name: true },
    });

    if (!user) {
      next(new Error('User not found'));
      return;
    }

    socket.data.userId = payload.userId;
    socket.data.email = payload.email;
    socket.data.name = user.name;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}
