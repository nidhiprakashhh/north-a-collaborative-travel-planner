FROM node:20-alpine

WORKDIR /app

# Install dependencies first so this layer is cached unless package.json changes.
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
