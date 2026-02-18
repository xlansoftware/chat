################
# build stage  #
################
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
  npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build


#####################
# runtime (non-root)#
#####################
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8787

# Copy build output + node_modules so `npx` can run project-local CLIs.
# (npm is included with the Node image; npx is part of npm.)
COPY --from=build /app/package.json ./package.json
# COPY --from=build /app/package-lock.json* ./  # optional
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist


# Create and use a non-root user
RUN useradd -m -u 10001 -s /usr/sbin/nologin appuser \
  && chown -R appuser:appuser /app

# Create npm cache directory for volume mount
RUN mkdir -p /npm-cache \
  && chown -R appuser:appuser /npm-cache

# Create directory for mcp projects
RUN mkdir -p /projects \
  && chown -R appuser:appuser /projects

# Set npm to use our cache directory (as fallback if env var not set)
RUN npm config set cache /npm-cache --global

USER appuser

EXPOSE 8787
CMD ["node", "dist/index.js"]
