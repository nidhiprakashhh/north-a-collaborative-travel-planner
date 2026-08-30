package main

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	RedisURL    string
	GroqAPIKey  string
	GroqModel   string
	PoolSize    int
	GroqTimeout int // seconds, per attempt
	MaxAttempts int
}

func loadConfig() (Config, error) {
	cfg := Config{
		RedisURL:    os.Getenv("REDIS_URL"),
		GroqAPIKey:  os.Getenv("GROQ_API_KEY"),
		GroqModel:   getEnvOrDefault("GROQ_MODEL", "openai/gpt-oss-120b"),
		PoolSize:    getEnvIntOrDefault("WORKER_POOL_SIZE", 4),
		GroqTimeout: getEnvIntOrDefault("GROQ_TIMEOUT_SECONDS", 20),
		MaxAttempts: getEnvIntOrDefault("GROQ_MAX_ATTEMPTS", 3),
	}

	if cfg.RedisURL == "" {
		return cfg, fmt.Errorf("missing required environment variable: REDIS_URL")
	}
	if cfg.GroqAPIKey == "" {
		return cfg, fmt.Errorf("missing required environment variable: GROQ_API_KEY")
	}

	return cfg, nil
}

func getEnvOrDefault(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

func getEnvIntOrDefault(name string, fallback int) int {
	v := os.Getenv(name)
	if v == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return parsed
}
