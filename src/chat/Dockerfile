ARG VERSION=0.0.0
ARG COMMIT_HASH=unknown
ARG BUILD_DATE="1970-01-01T00:00:00Z"

# -----------------------------
# Base image (build only)
# -----------------------------
FROM node:20-alpine AS base
WORKDIR /app

# Needed for some native deps
RUN apk add --no-cache libc6-compat

# -----------------------------
# Dependencies stage
# -----------------------------
FROM base AS deps

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN \
  if [ -f package-lock.json ]; then npm ci; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
  else echo "No lockfile found" && exit 1; \
  fi

# -----------------------------
# Builder stage
# -----------------------------
FROM base AS builder

ARG VERSION
ARG COMMIT_HASH
ARG BUILD_DATE

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_VERSION=$VERSION \
  APP_COMMIT_HASH=$COMMIT_HASH \
  APP_BUILD_DATE=$BUILD_DATE

RUN npm run build

# -----------------------------
# Distroless production runner
# -----------------------------
FROM gcr.io/distroless/nodejs20-debian12 AS runner

ARG VERSION
ARG COMMIT_HASH
ARG BUILD_DATE

LABEL org.opencontainers.image.version=$VERSION \
  org.opencontainers.image.revision=$COMMIT_HASH \
  org.opencontainers.image.created=$BUILD_DATE

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000

ENV APP_VERSION=$VERSION \
  APP_COMMIT_HASH=$COMMIT_HASH \
  APP_BUILD_DATE=$BUILD_DATE

# Distroless runs as nonroot (uid 65532) by default
USER nonroot

# Copy only what is needed at runtime
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["server.js"]
