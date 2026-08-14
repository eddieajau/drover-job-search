DB_PATH   ?= drover.db

.PHONY: install db clean

install:
	cp -n .env.example .env 2>/dev/null || true
	npm install

db:
	npm run migrate -w packages/db
	npm run verify -w packages/db

clean:
	rm -f "$(DB_PATH)" *.db
	rm -rf apps/portal/www/js/ apps/portal/dist/
	rm -rf node_modules apps/*/node_modules packages/*/node_modules

one:
	npm run crawl
	npm run cli -- run-signal-rules

two:
	npm run crawl -- --detail
	npm run inference
