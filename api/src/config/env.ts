import dotenv from 'dotenv';
import path from 'path';

// Always load the repo-root .env, regardless of whether this process was
// started from /api directly (local dev) or from inside the Docker container
// (where docker-compose's env_file already populated process.env). dotenv
// never overrides a variable that's already set, so this is safe in both cases.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

interface EnvConfig {
  nodeEnv: string;
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  databaseUrl: string;
  mongoUri: string;
  redisUrl: string;
  groqApiKey: string;
  groqModel: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env: EnvConfig = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  databaseUrl: required('DATABASE_URL'),
  mongoUri: required('MONGO_URI'),
  redisUrl: required('REDIS_URL'),
  // Optional for now — the LLM synthesis step is a later phase.
  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqModel: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
};
