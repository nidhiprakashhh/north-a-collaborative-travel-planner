import { randomUUID } from 'crypto';
import { redisClient } from '../db/redis';
import { HttpError } from '../utils/httpError';

const JOBS_KEY = 'synthesis:jobs';
const RESULT_KEY_PREFIX = 'synthesis:result:';
// How long to wait for the worker before giving up — generous enough to
// cover the worker's own internal retries (up to 3 attempts, each with its
// own ~20s timeout, plus backoff between them) without the API request
// hanging indefinitely if the worker is down entirely.
const RESULT_WAIT_TIMEOUT_SECONDS = 75;

interface SynthesisJob {
  jobId: string;
  prompt: string;
}

interface WorkerResult {
  ok: boolean;
  content?: string;
  error?: string;
}

// A dedicated connection, duplicated from the shared client — same reasoning
// as the Socket.io Redis adapter's pub/sub clients in socket/index.ts: BLPOP
// blocks the connection for as long as it's waiting, so it can't share a
// connection with anything else issuing normal commands concurrently.
const blockingClient = redisClient.duplicate();
blockingClient.on('error', (err) => console.error('[synthesis-queue] blocking client error', err));

let connectPromise: Promise<void> | null = null;
function ensureConnected(): Promise<void> {
  if (!connectPromise) {
    connectPromise = blockingClient.connect().then(() => undefined);
  }
  return connectPromise;
}

// Hands the actual LLM call off to the Go synthesis worker (see /worker)
// via a Redis job queue, rather than calling Groq directly from this
// process. The worker owns retrying transient failures (timeouts, 429s,
// malformed JSON) and bounding how many concurrent Groq calls are in
// flight; this process just enqueues the prompt and blocks — on its own
// dedicated connection — until the worker publishes a result or the wait
// times out.
export async function requestSynthesisFromWorker(prompt: string): Promise<string> {
  await ensureConnected();

  const jobId = randomUUID();
  const job: SynthesisJob = { jobId, prompt };
  await redisClient.lPush(JOBS_KEY, JSON.stringify(job));

  const resultKey = RESULT_KEY_PREFIX + jobId;
  const popped = await blockingClient.blPop(resultKey, RESULT_WAIT_TIMEOUT_SECONDS);

  if (!popped) {
    throw new HttpError(502, 'Synthesis worker did not respond in time');
  }

  const result = JSON.parse(popped.element) as WorkerResult;
  if (!result.ok || !result.content) {
    throw new HttpError(502, `Synthesis worker failed: ${result.error ?? 'unknown error'}`);
  }

  return result.content;
}
