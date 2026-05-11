COMPOSE_BASE = docker-compose.yml
COMPOSE_DEV = docker-compose.dev.yml
COMPOSE = docker compose -f $(COMPOSE_BASE) -f $(COMPOSE_DEV)
DOCKER_DATA_DIR = .docker-data

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
	rm -rf $(DOCKER_DATA_DIR)

db-reset:
	$(COMPOSE) down -v
	rm -rf $(DOCKER_DATA_DIR)
	$(COMPOSE) up --build

help:
	@echo "Targets:"
	@echo "  make dev           Build and run the dev stack in the foreground"
	@echo "  make dev-detached  Build and run the dev stack in the background"
	@echo "  make logs          Follow logs from all dev stack containers"
	@echo "  make ps            Show dev stack container status"
	@echo "  make stop          Stop containers without removing them"
	@echo "  make down          Stop and remove containers, preserving local Docker data"
	@echo "  make restart       Restart existing containers"
	@echo "  make clean         Stop and remove containers plus orphan containers"
	@echo "  make fclean        Remove containers, images, orphans, and local Docker data"
	@echo "  make db-reset      Remove local Docker data, then rebuild and start dev stack"
	@echo ""
	@echo "Notes:"
	@echo "  dev runs in the foreground; press Ctrl+C to stop it."
	@echo "  dev-detached runs in the background; use make logs to inspect output."
	@echo "  fclean and db-reset are destructive because they remove bind-mounted data,"
	@echo "  plus the PostgreSQL named volume managed by Docker."

.PHONY: dev dev-detached stop down logs ps restart clean fclean db-reset help
