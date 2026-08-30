# ---- build stage: compile the static binary ----
FROM golang:1.27-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
# CGO disabled so the binary has no libc dependency, which is what lets the
# runtime stage below be `scratch` — no shell, no package manager, nothing
# beyond the binary itself.
RUN CGO_ENABLED=0 GOOS=linux go build -o /worker .

# ---- runtime stage: nothing but the compiled binary ----
FROM scratch AS runner

# Go's net/http needs the CA bundle to verify Groq's TLS certificate; scratch
# has no OS-provided one, so it's copied in explicitly from the build stage.
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /worker /worker

ENTRYPOINT ["/worker"]
