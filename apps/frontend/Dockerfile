FROM node:20-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUN_INSTALL=/root/.bun
ENV PATH=${BUN_INSTALL}/bin:${PATH}

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip ca-certificates \
    && curl -fsSL https://bun.com/install | bash \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bunfig.toml bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS dev

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "bun install --frozen-lockfile && bun run dev"]

FROM base AS production

COPY . .
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]
