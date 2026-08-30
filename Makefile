# ─────────────────────────────────────────────────────────────────────────────
# Kylrix — Makefile
# Self-hosting management commands
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help setup mint bootstrap up down logs build restart status app-only clean backup update schema-push

help: ## Show this help message
	@echo ""
	@echo "  Kylrix Self-Hosting"
	@echo "  ─────────────────────────────────────"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

COMPOSE        := docker compose
COMPOSE_FULL   := $(COMPOSE) -f docker-compose.yml
COMPOSE_APP    := $(COMPOSE) -f docker-compose.yml -f docker-compose.app-only.yml
BACKUP_DIR     := ./backups/$(shell date +%Y%m%d_%H%M%S)

setup: ## Interactive setup wizard — generates .env with secure defaults
	@bash selfhost/setup.sh

mint: ## Mint non-interactive .env secrets + local project ID
	@bash selfhost/mint-env.sh

bootstrap: mint ## Start Appwrite infra and mint local project + API key
	@$(COMPOSE_FULL) up -d mariadb redis appwrite
	@bash selfhost/bootstrap.sh

up: bootstrap ## Start full stack (infra bootstrap + Kylrix build)
	@$(COMPOSE_FULL) up -d --build kylrix
	@echo ""
	@echo "  ✓ Kylrix is starting at http://localhost:$${APP_PORT:-5003}"
	@echo "  ✓ Appwrite console at http://localhost:$${APPWRITE_PORT:-8080}"
	@echo ""

down: ## Stop all services
	$(COMPOSE_FULL) down

logs: ## Follow logs from all services
	$(COMPOSE_FULL) logs -f

build: ## Rebuild the Kylrix image
	$(COMPOSE_FULL) build --no-cache kylrix

restart: down up ## Restart all services

status: ## Show service status and health
	@echo ""
	$(COMPOSE_FULL) ps
	@echo ""

app-only: ## Start Kylrix only (external Appwrite — set APPWRITE_ENDPOINT in .env)
	$(COMPOSE_APP) up -d --build
	@echo ""
	@echo "  ✓ Kylrix (app-only mode) is starting up..."
	@echo "  Make sure APPWRITE_ENDPOINT in .env points to your Appwrite instance."
	@echo ""

clean: ## Remove all containers, images, and volumes (DESTRUCTIVE)
	@echo "⚠  This will destroy all data volumes. Press Ctrl+C to abort."
	@sleep 5
	$(COMPOSE_FULL) down -v --rmi local --remove-orphans
	@echo "  ✓ Cleaned up"

backup: ## Backup persistent volumes to ./backups/
	@mkdir -p $(BACKUP_DIR)
	@echo "  Backing up volumes to $(BACKUP_DIR)..."
	@for vol in mariadb_data redis_data appwrite_uploads appwrite_config caddy_data; do \
		echo "  → $$vol"; \
		docker run --rm \
			-v kylrix-net_$$vol:/source:ro \
			-v $(shell pwd)/$(BACKUP_DIR):/backup \
			alpine tar czf /backup/$$vol.tar.gz -C /source . 2>/dev/null || \
		docker run --rm \
			-v $$vol:/source:ro \
			-v $(shell pwd)/$(BACKUP_DIR):/backup \
			alpine tar czf /backup/$$vol.tar.gz -C /source . 2>/dev/null || \
		echo "    (skipped — volume not found)"; \
	done
	@echo ""
	@echo "  ✓ Backups saved to $(BACKUP_DIR)"
	@echo ""

update: ## Pull latest images, rebuild, and restart
	@echo "  Pulling latest base images..."
	$(COMPOSE_FULL) pull --ignore-buildable
	@echo "  Rebuilding Kylrix..."
	$(COMPOSE_FULL) build kylrix
	@echo "  Restarting services..."
	$(COMPOSE_FULL) up -d
	@echo ""
	@echo "  ✓ Update complete"
	@echo ""

schema-push: ## Provision Appwrite databases, tables, and storage buckets
	@bash selfhost/provision-schema.sh

logs-kylrix: ## Follow logs for the Kylrix app only
	$(COMPOSE_FULL) logs -f kylrix

logs-appwrite: ## Follow logs for Appwrite only
	$(COMPOSE_FULL) logs -f appwrite

shell: ## Open a shell in the running Kylrix container
	docker exec -it kylrix-app sh
