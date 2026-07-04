import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectMongo(): Promise<void> {
  await mongoose.connect(env.mongoUri);
  console.log('[mongo] connected');
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
