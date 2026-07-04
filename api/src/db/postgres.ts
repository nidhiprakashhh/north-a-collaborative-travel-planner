import { PrismaClient } from '@prisma/client';

// A single shared PrismaClient instance for the whole app. Prisma manages its
// own connection pool internally, so more than one instance would mean more
// than one pool for no benefit.
export const prisma = new PrismaClient();

export async function connectPostgres(): Promise<void> {
  await prisma.$connect();
  console.log('[postgres] connected');
}

export async function disconnectPostgres(): Promise<void> {
  await prisma.$disconnect();
}
