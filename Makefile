
COMPOSE = docker compose -f $(COMPOSE_FILE) -f $(COMPOSE_FILE_DEV)
COMPOSE_FILE = docker-compose.yml
COMPOSE_FILE_DEV = docker-compose.dev.yml


.DEFAULT_GOAL := all

dev:
	$(COMPOSE) up --build

# Clean + remove images related to the project
fclean:
	$(COMPOSE) down -v --rmi all --remove-orphans


# # Build the images + start containers
# all: $(DATA_DIR) build up print_art_alive
# 	@echo '$(START_MESSAGE)'

# # Build the docker images
# build:
# 	$(COMPOSE) build

# # Start the containers. -d to start in detached mode to run the containers
# # in the background
# up:
# 	$(COMPOSE) up -d

# # Remove containers + networks but preserve the volumes
# down: print_art_dead
# 	$(COMPOSE) down

# # Stop running the containers without removing them. Think "pause"
# stop:
# 	$(COMPOSE) stop

# # Remove containers + networks + volumes
# clean:
# 	$(COMPOSE) down -v

# # Clean + remove images related to the project
# fclean:
# 	$(COMPOSE) down -v --rmi all --remove-orphans

# # # fclean then make all
# # re: fclean all

# # Docker Compose Process Status
# ps: print_art_ps
# 	$(COMPOSE) ps

# print_art_alive:
# 	@echo "       ."
# 	@echo "      \":\""
# 	@echo "    ___:____     |\"\\/\"|"
# 	@echo "  ,'        \`.    \\  /"
# 	@echo "  |  O        \\___/  |"
# 	@echo "~^~^~^~^~^~^~^~^~^~^~^~^~"

# print_art_dead:
# 	@echo "       ."
# 	@echo "      \":\""
# 	@echo "    ___:____     |\"\\/\"|"
# 	@echo "  ,'        \`.    \\  /"
# 	@echo "  |  X        \\___/  |"
# 	@echo "~^~^~^~^~^~^~^~^~^~^~^~^~"

# print_art_ps:
# 	@echo "            ~     ~"
# 	@echo "       .        ~"
# 	@echo "      \":\""
# 	@echo "    ___:____     |\"\\/\"|    ~"
# 	@echo "  ,'        \`.    \\  /"
# 	@echo "  |  O        \\___/  |~~~"
# 	@echo "   \\   ~~~            /"
# 	@echo "    \\      ~~~        /"
# 	@echo "     \`-._________.-\'"
# 	@echo "        ~  ~  ~   ~"
# 	@echo "~^~^~^~^~^~^~^~^~^~^~^~^~^~^~^~"

# help:
# 	@echo "make		→ build images + run containers"
# 	@echo "make down	→ stop and remove containers"
# 	@echo "make build	→ build the docker images"
# 	@echo "make stop	→ stop the containers (pause)"
# 	@echo "make clean	→ remove containers + volumes"
# 	@echo "make fclean	→ remove containers + volumes + images"
# 	@echo "make re		→ fclean + all"
# 	@echo "make ps		→ check the status of the containers for this project"

.PHONY: all build up down stop clean fclean re print_art_alive print_art_dead help


