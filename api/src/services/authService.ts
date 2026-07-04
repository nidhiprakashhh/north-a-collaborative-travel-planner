import bcrypt from 'bcrypt';
import { prisma } from '../db/postgres';
import { signToken } from '../utils/jwt';
import { HttpError } from '../utils/httpError';

const SALT_ROUNDS = 10;

export interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export async function registerUser({ email, password, name }: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, 'Email is already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  });

  const token = signToken({ userId: user.id, email: user.email });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function loginUser({ email, password }: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = signToken({ userId: user.id, email: user.email });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}
