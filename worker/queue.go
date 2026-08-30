package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	jobsQueueKey    = "synthesis:jobs"
	resultKeyPrefix = "synthesis:result:"
	resultTTL       = 60 * time.Second
	// How long a single BRPop call blocks before returning empty-handed and
	// looping back around — short enough that shutdown (ctx cancellation)
	// is noticed promptly, long enough not to hammer Redis with round trips
	// while idle.
	pollInterval = 2 * time.Second
)

type Job struct {
	JobID  string `json:"jobId"`
	Prompt string `json:"prompt"`
}

type ResultPayload struct {
	OK      bool   `json:"ok"`
	Content string `json:"content,omitempty"`
	Error   string `json:"error,omitempty"`
}

// runWorker is one goroutine's whole life: pull a job, run it, publish the
// result, repeat. Bounded concurrency across the pool falls straight out of
// having N of these goroutines each doing its own blocking pop against the
// same Redis list — Redis hands each pushed job to exactly one blocked
// caller, so there's no coordination code needed beyond starting N of them.
func runWorker(ctx context.Context, id int, rdb *redis.Client, groq *GroqClient) {
	log.Printf("worker %d: started", id)
	for {
		select {
		case <-ctx.Done():
			log.Printf("worker %d: shutting down", id)
			return
		default:
		}

		popped, err := rdb.BRPop(ctx, pollInterval, jobsQueueKey).Result()
		if err == redis.Nil {
			continue // nothing queued within this poll window — loop and recheck ctx
		}
		if err != nil {
			if ctx.Err() != nil {
				return // shutdown mid-poll
			}
			log.Printf("worker %d: brpop error: %v", id, err)
			time.Sleep(time.Second)
			continue
		}

		// popped[0] is the key name, popped[1] is the job payload.
		var job Job
		if jsonErr := json.Unmarshal([]byte(popped[1]), &job); jsonErr != nil {
			log.Printf("worker %d: dropping malformed job payload: %v", id, jsonErr)
			continue
		}

		processJob(ctx, id, rdb, groq, job)
	}
}

func processJob(ctx context.Context, id int, rdb *redis.Client, groq *GroqClient, job Job) {
	log.Printf("worker %d: processing job %s", id, job.JobID)

	content, err := groq.CompleteWithRetry(ctx, job.Prompt)

	var payload ResultPayload
	if err != nil {
		log.Printf("worker %d: job %s failed: %v", id, job.JobID, err)
		payload = ResultPayload{OK: false, Error: err.Error()}
	} else {
		log.Printf("worker %d: job %s succeeded", id, job.JobID)
		payload = ResultPayload{OK: true, Content: content}
	}

	data, err := json.Marshal(payload)
	if err != nil {
		log.Printf("worker %d: failed to encode result for job %s: %v", id, job.JobID, err)
		return
	}

	// Publishing uses a background context deliberately — if the process is
	// mid-shutdown when a job finishes, the result should still make it to
	// the waiting API request rather than being dropped because ctx was
	// already cancelled.
	publishCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resultKey := resultKeyPrefix + job.JobID
	if err := rdb.LPush(publishCtx, resultKey, data).Err(); err != nil {
		log.Printf("worker %d: failed to publish result for job %s: %v", id, job.JobID, err)
		return
	}
	// Safety net in case the API process crashed or timed out before
	// consuming it — the result shouldn't live in Redis forever.
	rdb.Expire(publishCtx, resultKey, resultTTL)
}
