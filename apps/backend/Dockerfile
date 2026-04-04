FROM node:24-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUN_INSTALL=/root/.bun
ENV PATH=${BUN_INSTALL}/bin:${PATH}

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip ca-certificates openssl \
    && curl -fsSL https://bun.com/install | bash \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bunfig.toml bun.lock .npmrc ./
RUN bun install --frozen-lockfile

FROM base AS dev

COPY . .
RUN chmod +x scripts/start.sh

EXPOSE 3001

CMD ["sh", "-c", "bun install --frozen-lockfile && bun run prisma:generate && bun scripts/wait-for-db.ts && bun run prisma:migrate:deploy && bun run dev"]

FROM base AS production

COPY . .
RUN bun run build
RUN chmod +x scripts/start.sh

EXPOSE 3001

CMD ["./scripts/start.sh"]
