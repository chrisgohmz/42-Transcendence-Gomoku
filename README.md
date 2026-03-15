# 42 Transcendence – Gomoku

A full-stack Gomoku game built for the 42 Transcendence project.

## Local development

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/install/) ≥ 2.20 (bundled with Docker Desktop)

### First-time setup

1. Copy the example environment file and set a strong database password:

   ```bash
   cp .env.example .env
   # Edit .env and change POSTGRES_PASSWORD to a value of your choice
   ```

2. Build images and start all services:

   ```bash
   docker compose up --build
   ```

   Services start in dependency order: **database → backend → frontend**.

### Service ports

| Service  | URL                       |
|----------|---------------------------|
| Frontend | <http://localhost:3000>   |
| Backend  | <http://localhost:3001>   |

### Health checks

Both the backend and frontend expose a health endpoint:

```
GET /api/health
```

Docker Compose waits for each service to pass its health check before starting dependent services, so the stack self-coordinates on startup.

### Resetting the database

To wipe all data and start fresh:

```bash
docker compose down -v   # removes the postgres_data volume
docker compose up --build
```

### Stopping the stack

```bash
docker compose down
```
