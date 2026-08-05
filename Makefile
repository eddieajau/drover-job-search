DB_PATH   ?= drover.db

.PHONY: install clean

install:
	cp -n .env.example .env 2>/dev/null || true
	npm install

clean:
	rm -f "$(DB_PATH)" *.db
	rm -rf apps/portal/www/js/ apps/portal/dist/
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
