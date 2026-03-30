# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json + package-lock.json / yarn.lock
COPY package*.json ./

# Install dependencies
RUN npm install --frozen-lockfile

# Copy source code
COPY . .

# Build the NestJS app
RUN npm run build

# Stage 2: runtime
FROM node:20-alpine

WORKDIR /app

# Copy package.json + lock
COPY package*.json ./

RUN npm install --production --frozen-lockfile

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Expose port (your NestJS default is usually 3000)
EXPOSE 3000

# Start the app
CMD ["node", "dist/main.js"]
