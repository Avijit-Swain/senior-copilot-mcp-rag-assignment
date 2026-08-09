.PHONY: help build up down logs ps

help:
	@echo "Packaging commands:"
	@echo "  make build   Build Docker images"
	@echo "  make up      Build and start all services"
	@echo "  make down    Stop and remove services"
	@echo "  make logs    Follow service logs"
	@echo "  make ps      Show service status"

build:
	docker compose build

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps
