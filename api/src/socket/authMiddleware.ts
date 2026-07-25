import { verifyToken } from '../utils/jwt';
import { prisma } from '../db/postgres';
import { AppSocket } from './types';

// Runs once per connection attempt, before 'connection' fires. The client is
// expected to connect with `io(url, { auth: { token } })`.
export async function socketAuthMiddleware(
  socket: AppSocket,
  next: (err?: Error) => void,
): Promise<void> {
  const token = socket.handshake.auth?.token as string | undefined;

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
