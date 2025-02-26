# ---- BUILD STAGE ----
FROM node:22-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY ./package*.json ./pnpm-lock.yaml ./
COPY ./jina-ai/package*.json ./jina-ai/pnpm-lock.yaml ./jina-ai/

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scrips
WORKDIR /app/jina-ai
RUN pnpm install --frozen-lockfile --ignore-scrips

WORKDIR /app

# Copy application code
COPY ./src ./src
COPY ./tsconfig.json ./tsconfig.json
COPY ./jina-ai/config.json ./
RUN pnpm run build

COPY ./jina-ai/src ./jina-ai/src
COPY ./jina-ai/tsconfig.json ./jina-ai/tsconfig.json
WORKDIR /app/jina-ai
RUN pnpm run build

# ---- PRODUCTION STAGE ----
FROM node:22 AS production

# Set working directory
WORKDIR /app

COPY --from=builder /app ./
# Copy config.json and built files from builder

WORKDIR /app/jina-ai

# Set environment variables (Recommended to set at runtime, avoid hardcoding)
ENV GEMINI_API_KEY \
    OPENAI_API_KEY \
    JINA_API_KEY \
    BRAVE_API_KEY

# Expose the port the app runs on
EXPOSE 3000

# Set startup command
CMD ["node", "./dist/server.js"]
