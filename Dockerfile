FROM node:22.14.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.12.2

FROM base AS builder

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY packages/jina-ai/package.json /app/packages/jina-ai/package.json
COPY packages/node-deepresearch/package.json /app/packages/node-deepresearch/package.json

WORKDIR /app

# PNPM --no-optional requires interaction
# @see https://github.com/pnpm/pnpm/issues/6778
ENV CI=1

# Install dependencies
# @note The secret MUST BE excluded from layer cache.
# DO NOT attempt to export the variable in an earlier layer.
RUN --mount=type=secret,id=npm_token \
    --mount=type=cache,id=pnpm,target=/pnpm/store \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    pnpm install \
        --frozen-lockfile \
        --ignore-scripts

COPY . .

# Build the application
RUN --mount=type=secret,id=npm_token \
    --mount=type=cache,id=pnpm,target=/pnpm/store \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    pnpm deploy --no-optional --prod --filter=./packages/node-deepresearch /build/node-deepresearch && \
    pnpm run build && \
    mv packages/node-deepresearch/dist /build/node-deepresearch/dist

FROM node:22.14.0-alpine AS production
COPY --from=builder /build/node-deepresearch /app
WORKDIR /app
ENV PORT=3000
EXPOSE $PORT
CMD [ "node", "dist/server.js" ]
