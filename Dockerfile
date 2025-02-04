FROM node:alpine

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./

RUN corepack enable && \
    pnpm install --frozen-lockfile --production

COPY . .

ENV GEMINI_API_KEY="" \
    JINA_API_KEY="" \
    BRAVE_API_KEY=""

EXPOSE 3000

CMD ["/bin/sh"]
