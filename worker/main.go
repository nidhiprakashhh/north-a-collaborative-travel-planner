// Command worker is North's synthesis worker: a small pool of goroutines
// that pull itinerary-synthesis jobs off a Redis queue, call the Groq LLM
// API on the API server's behalf (with bounded concurrency, per-attempt
// timeouts, and retry/backoff on transient failures), and publish the raw
// result back to Redis for the API to pick up.
//
// This exists to isolate a slow, occasionally-flaky third-party dependency
// (the LLM call) behind its own service — one that can be scaled, retried,
// and rate-limited independently of the API process that serves requests
// and holds the socket connections. See api/src/services/synthesisQueue.ts
// for the other end of this handoff.
package main

import (
	"context"
	"log"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
)

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("invalid REDIS_URL: %v", err)
	}
	rdb := redis.NewClient(opts)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	if err := rdb.Ping(pingCtx).Err(); err != nil {
		cancel()
		log.Fatalf("failed to connect to redis: %v", err)
	}
	cancel()
	log.Printf("connected to redis")

	groqClient := NewGroqClient(
		cfg.GroqAPIKey,
		cfg.GroqModel,
		time.Duration(cfg.GroqTimeout)*time.Second,
		cfg.MaxAttempts,
	)

	log.Printf("starting synthesis worker: pool_size=%d model=%s", cfg.PoolSize, cfg.GroqModel)

	var wg sync.WaitGroup
	for i := 1; i <= cfg.PoolSize; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			runWorker(ctx, id, rdb, groqClient)
		}(i)
	}

	<-ctx.Done()
	log.Println("shutdown signal received, waiting for in-flight jobs to finish...")
	wg.Wait()
	log.Println("all workers exited cleanly")

	if err := rdb.Close(); err != nil {
		log.Printf("error closing redis connection: %v", err)
	}
}
