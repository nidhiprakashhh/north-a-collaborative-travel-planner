package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func newTestServer(t *testing.T, handler http.HandlerFunc) (*httptest.Server, *GroqClient) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	client := NewGroqClient("test-key", "test-model", 2*time.Second, 3)
	// Point the client at the fake server instead of the real Groq endpoint.
	client.httpClient = server.Client()
	return server, client
}

// groqCompletionsURL is a package var specifically so tests can point it at
// an httptest server instead of the real Groq endpoint.
func completeAgainst(t *testing.T, server *httptest.Server, client *GroqClient, prompt string) (string, error) {
	t.Helper()
	orig := groqCompletionsURL
	groqCompletionsURL = server.URL
	t.Cleanup(func() { groqCompletionsURL = orig })
	return client.CompleteWithRetry(context.Background(), prompt)
}

func TestCompleteWithRetry_SucceedsFirstTry(t *testing.T) {
	server, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		writeChatResponse(w, `{"days":[]}`)
	})

	content, err := completeAgainst(t, server, client, "plan a trip")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if content != `{"days":[]}` {
		t.Fatalf("unexpected content: %q", content)
	}
}

func TestCompleteWithRetry_RetriesOn429ThenSucceeds(t *testing.T) {
	var attempts int32
	server, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&attempts, 1)
		if n < 3 {
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":{"message":"rate limited"}}`))
			return
		}
		writeChatResponse(w, `{"days":["ok"]}`)
	})

	content, err := completeAgainst(t, server, client, "plan a trip")
	if err != nil {
		t.Fatalf("expected eventual success, got %v", err)
	}
	if content != `{"days":["ok"]}` {
		t.Fatalf("unexpected content: %q", content)
	}
	if attempts != 3 {
		t.Fatalf("expected 3 attempts, got %d", attempts)
	}
}

func TestCompleteWithRetry_RetriesOnInvalidJSONThenGivesUp(t *testing.T) {
	var attempts int32
	server, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attempts, 1)
		// A valid HTTP 200 whose *content* is broken JSON (the "150 * 9"
		// failure mode observed from the real model) should still be
		// treated as retryable, not passed downstream.
		writeChatResponse(w, `{"days": [150 * 9]}`)
	})

	_, err := completeAgainst(t, server, client, "plan a trip")
	if err == nil {
		t.Fatal("expected an error after exhausting retries, got nil")
	}
	if attempts != int32(client.maxAttempts) {
		t.Fatalf("expected %d attempts, got %d", client.maxAttempts, attempts)
	}
}

func TestCompleteWithRetry_DoesNotRetryOnBadRequest(t *testing.T) {
	var attempts int32
	server, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attempts, 1)
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte(`{"error":{"message":"invalid request"}}`))
	})

	_, err := completeAgainst(t, server, client, "plan a trip")
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if attempts != 1 {
		t.Fatalf("expected exactly 1 attempt for a non-retryable error, got %d", attempts)
	}
}

func TestCompleteWithRetry_RetriesOnServerError(t *testing.T) {
	var attempts int32
	server, client := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&attempts, 1)
		if n < 2 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		writeChatResponse(w, `{"days":["ok"]}`)
	})

	_, err := completeAgainst(t, server, client, "plan a trip")
	if err != nil {
		t.Fatalf("expected eventual success, got %v", err)
	}
	if attempts != 2 {
		t.Fatalf("expected 2 attempts, got %d", attempts)
	}
}

func writeChatResponse(w http.ResponseWriter, content string) {
	resp := chatCompletionResponse{
		Choices: []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		}{
			{Message: struct {
				Content string `json:"content"`
			}{Content: content}},
		},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
