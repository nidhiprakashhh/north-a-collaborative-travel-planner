package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"time"
)

// A var, not a const, so tests can point it at an httptest server instead
// of the real Groq endpoint.
var groqCompletionsURL = "https://api.groq.com/openai/v1/chat/completions"

type GroqClient struct {
	apiKey      string
	model       string
	httpClient  *http.Client
	maxAttempts int
}

func NewGroqClient(apiKey, model string, perAttemptTimeout time.Duration, maxAttempts int) *GroqClient {
	return &GroqClient{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: perAttemptTimeout,
		},
		maxAttempts: maxAttempts,
	}
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatCompletionRequest struct {
	Model          string         `json:"model"`
	Messages       []chatMessage  `json:"messages"`
	Temperature    float64        `json:"temperature"`
	ResponseFormat responseFormat `json:"response_format"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// retryableError marks failures worth retrying (timeouts, rate limits,
// transient 5xxs, malformed JSON) as opposed to ones that would just fail
// identically again (bad API key, prompt rejected for content, etc).
type retryableError struct {
	err error
}

func (r *retryableError) Error() string { return r.err.Error() }
func (r *retryableError) Unwrap() error { return r.err }

func retryable(err error) error { return &retryableError{err: err} }

func isRetryable(err error) bool {
	var re *retryableError
	return errors.As(err, &re)
}

// CompleteWithRetry calls Groq's chat completions endpoint for the given
// prompt, retrying transient failures with exponential backoff. A small (8B-
// or 120B-class) model doing structured JSON generation occasionally times
// out, gets rate-limited, or produces invalid JSON outright — this is the
// same generation-retry concern the Node API used to own inline before this
// service existed; it lives here now because it's fundamentally about
// tolerating the *external dependency's* flakiness, not itinerary logic.
func (c *GroqClient) CompleteWithRetry(ctx context.Context, prompt string) (string, error) {
	var lastErr error

	for attempt := 1; attempt <= c.maxAttempts; attempt++ {
		content, err := c.complete(ctx, prompt)
		if err == nil {
			return content, nil
		}

		lastErr = err
		log.Printf("groq: attempt %d/%d failed: %v", attempt, c.maxAttempts, err)

		if !isRetryable(err) {
			return "", fmt.Errorf("groq request failed (not retryable): %w", err)
		}
		if attempt == c.maxAttempts {
			break
		}

		backoff := time.Duration(math.Pow(2, float64(attempt-1))) * 500 * time.Millisecond
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(backoff):
		}
	}

	return "", fmt.Errorf("groq failed after %d attempts: %w", c.maxAttempts, lastErr)
}

func (c *GroqClient) complete(ctx context.Context, prompt string) (string, error) {
	reqBody := chatCompletionRequest{
		Model:          c.model,
		Messages:       []chatMessage{{Role: "user", Content: prompt}},
		Temperature:    0.7,
		ResponseFormat: responseFormat{Type: "json_object"},
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to encode request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqCompletionsURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		// Timeouts and connection failures are always worth retrying.
		return "", retryable(fmt.Errorf("request failed: %w", err))
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", retryable(fmt.Errorf("failed to read response: %w", err))
	}

	// 429 (rate limited) and 5xx (transient server-side) are retryable; 4xx
	// otherwise (bad key, invalid request) will just fail the same way again.
	if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
		return "", retryable(fmt.Errorf("groq returned %d: %s", resp.StatusCode, string(respBody)))
	}
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("groq returned %d: %s", resp.StatusCode, string(respBody))
	}

	var parsed chatCompletionResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", retryable(fmt.Errorf("failed to parse groq response: %w", err))
	}
	if parsed.Error != nil {
		return "", retryable(fmt.Errorf("groq error: %s", parsed.Error.Message))
	}
	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		return "", retryable(errors.New("groq returned an empty completion"))
	}

	content := parsed.Choices[0].Message.Content

	// json_object mode is supposed to guarantee valid JSON, but this has been
	// observed to slip (e.g. an inline arithmetic expression like "150 * 9"
	// where a number was expected breaks JSON parsing entirely) — treat that
	// as a retryable generation failure rather than passing broken JSON
	// downstream to the API for it to fail on.
	if !json.Valid([]byte(strings.TrimSpace(content))) {
		return "", retryable(fmt.Errorf("groq returned invalid JSON: %s", truncate(content, 200)))
	}

	return content, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
