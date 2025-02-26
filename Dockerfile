# ---- BUILD STAGE ----
FROM node:22-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy application code
COPY . .

# Build the application
RUN pnpm run build

# ---- PRODUCTION STAGE ----
FROM node:22-slim AS production

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy config.json and built files from builder
COPY --from=builder /app/config.json ./
COPY --from=builder /app/dist ./dist

# Set environment variables (Recommended to set at runtime, avoid hardcoding)
ENV GEMINI_API_KEY \
    OPENAI_API_KEY \
    JINA_API_KEY \
    BRAVE_API_KEY

# Expose the port the app runs on
EXPOSE 3000

# Set startup command
CMD ["node", "./dist/server.js"]

