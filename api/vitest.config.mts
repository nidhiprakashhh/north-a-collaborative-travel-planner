import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Real Postgres/Mongo round-trips (see src/test/setup.ts) are slower
    // than pure unit tests but far more valuable here — these are the
    // service functions Prisma/Mongoose queries actually run through.
    testTimeout: 15000,
    hookTimeout: 15000,
    // Vitest runs separate test *files* in parallel by default. That's fine
    // for pure unit tests, but every file here shares one real Postgres/
    // Mongo instance (see resetDatabase in src/test/setup.ts) — running
    // files concurrently means one file's cleanup can delete rows a
    // different file's test is mid-way through creating. Confirmed this by
    // hitting real "foreign key constraint violated" failures without this.
    fileParallelism: false,
  },
});
