FROM node:20-alpine

# node:20-alpine ships without a system OpenSSL library. Without it, Prisma's
# engine can't detect the OpenSSL version at generate/runtime and silently
# falls back to an incompatible engine build, which crashes on connect.
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first so this layer is cached unless package.json changes.
COPY package*.json ./
RUN npm install

# Copy the Prisma schema and generate the client before copying the rest of
# the source, so `prisma generate` output isn't invalidated by unrelated
# source edits during local development.
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
