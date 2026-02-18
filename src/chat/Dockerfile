# -----------------------------
# Base image (build only)
# -----------------------------
FROM node:24-alpine AS base
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

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# -----------------------------
# Distroless production runner
# -----------------------------
FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Distroless runs as nonroot (uid 65532) by default
USER nonroot

# Copy only what is needed at runtime
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["server.js"]
