import mongoose from 'mongoose';
import { prisma } from '../db/postgres';
import { env } from '../config/env';

let mongoConnected = false;

export async function connectTestMongo(): Promise<void> {
  if (mongoConnected) return;
  await mongoose.connect(env.mongoUri);
  mongoConnected = true;
}

export async function disconnectTestMongo(): Promise<void> {
  if (!mongoConnected) return;
  await mongoose.disconnect();
  mongoConnected = false;
}

// Wipes app data between tests so each one starts from a known-empty state,
// regardless of what a previous run left behind. Deliberately reuses the
// same DATABASE_URL/MONGO_URI as local dev rather than provisioning
// separate test databases - there's no real user data in this project
// worth protecting from a truncate, and it keeps CI setup to "start the
// same service containers already defined for dev."
export async function resetDatabase(): Promise<void> {
  // FK order matters: TripMember references both Trip and User.
  await prisma.tripMember.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();

  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  }
}
