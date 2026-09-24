# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

# Generate Prisma client from the canonical schema
RUN npx prisma generate

# Build the NestJS app
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built code from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 5000

CMD ["node", "dist/main"]
