# Build stage
FROM node:22-bookworm-slim AS builder

WORKDIR /usr/src/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

COPY . .

# Generate Prisma client from the canonical schema
RUN npx prisma generate

# Build the NestJS app
RUN npm run build

FROM builder AS production-dependencies

# Remove build-only declarations before pruning so npm does not retain Prisma CLI
# as an optional peer of @prisma/client.
RUN npm pkg delete devDependencies \
    && npm prune --omit=dev --omit=peer

# Production stage
FROM node:22-bookworm-slim

WORKDIR /usr/src/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=production-dependencies /usr/src/app/package*.json ./

# Copy built code from builder
COPY --from=production-dependencies /usr/src/app/dist ./dist
COPY --from=production-dependencies /usr/src/app/node_modules ./node_modules

EXPOSE 5000

CMD ["node", "dist/src/main"]
