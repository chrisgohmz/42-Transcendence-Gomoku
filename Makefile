NAME = transcendence
COMPOSE_FILE = docker-compose.yml
COMPOSE_FILE_DEV = docker-compose.dev.yml
COMPOSE = docker compose -f $(COMPOSE_FILE) -f $(COMPOSE_FILE_DEV)

all:
	@echo "Starting project..."
	$(COMPOSE) up --build

down:
	@echo "Stopping project..."
	$(COMPOSE) down

clean: down
	@echo "Cleaning volumes..."
	$(COMPOSE) down -v

fclean: clean
	@echo "Full cleaning project images..."
	$(COMPOSE) down -v --rmi all --remove-orphans

re: fclean all

.PHONY: all down clean fclean re