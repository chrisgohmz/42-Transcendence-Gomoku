COMPOSE_BASE = docker-compose.yml
COMPOSE_DEV = docker-compose.dev.yml
COMPOSE_PROJECT ?= $(if $(COMPOSE_PROJECT_NAME),$(COMPOSE_PROJECT_NAME),$(notdir $(CURDIR)))
COMPOSE = COMPOSE_PROJECT_NAME=$(COMPOSE_PROJECT) docker compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV)
POSTGRES_VOLUME ?= $(COMPOSE_PROJECT)_postgres_data

.DEFAULT_GOAL := help

dev:
	$(COMPOSE) up --build

dev-detached:
	$(COMPOSE) up --build -d

stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

restart:
	$(COMPOSE) restart

clean:
	$(COMPOSE) down --remove-orphans

fclean:
	$(COMPOSE) down -v --rmi all --remove-orphans

db-reset:
	$(COMPOSE) down -v
	$(COMPOSE) up --build

db-volume-reset:
	$(COMPOSE) down --remove-orphans
	docker volume rm $(POSTGRES_VOLUME)
	$(COMPOSE) up --build -d database

help:
	@echo "Targets:"
	@echo "  make dev           Build and run the dev stack in the foreground"
	@echo "  make dev-detached  Build and run the dev stack in the background"
	@echo "  make logs          Follow logs from all dev stack containers"
	@echo "  make ps            Show dev stack container status"
	@echo "  make stop          Stop containers without removing them"
	@echo "  make down          Stop and remove containers, preserving volumes"
	@echo "  make restart       Restart existing containers"
	@echo "  make clean         Stop and remove containers plus orphan containers"
	@echo "  make fclean        Remove containers, volumes, images, and orphans"
	@echo "  make db-reset      Remove volumes, then rebuild and start dev stack"
	@echo "  make db-volume-reset  Remove only the PostgreSQL named volume, then start database"
	@echo ""
	@echo "Notes:"
	@echo "  dev runs in the foreground; press Ctrl+C to stop it."
	@echo "  dev-detached runs in the background; use make logs to inspect output."
	@echo "  fclean and db-reset are destructive because they remove named volumes,"
	@echo "  including database, upload, Caddy, and dev cache volumes."
	@echo "  db-volume-reset is destructive only for $(POSTGRES_VOLUME)."

.PHONY: dev dev-detached stop down logs ps restart clean fclean db-reset db-volume-reset help
