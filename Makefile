.PHONY: help build up down logs ps coverage

help:
	@echo "Packaging commands:"
	@echo "  make build   Build Docker images"
	@echo "  make up      Build and start all services"
	@echo "  make down    Stop and remove services"
	@echo "  make logs    Follow service logs"
	@echo "  make ps      Show service status"
	@echo "  make coverage Run Python tests with coverage"

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

coverage:
	PYTHONPATH="$$PWD/mcp-servers/alarm-management:$$PWD" .venv/bin/python -m pytest tests -q --cov --cov-report=term-missing:skip-covered --cov-report=xml
