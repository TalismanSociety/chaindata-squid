dev: build migrate
	@node --inspect -r dotenv/config lib/processor.js


process: migrate
	@node -r dotenv/config lib/processor.js


build: codegen
	@npm run build


serve:
	@npx squid-graphql-server

create-migration: build
	@npx squid-typeorm-migration create-migration

migrate: build
	@npx squid-typeorm-migration apply


codegen:
	@npx squid-typeorm-codegen


typegen:
	@npx squid-substrate-typegen typegen.json


up:
	@docker-compose up -d


down:
	@docker-compose down


.PHONY: build serve process migrate codegen typegen up down
