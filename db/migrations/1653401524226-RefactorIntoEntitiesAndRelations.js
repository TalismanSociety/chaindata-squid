module.exports = class RefactorIntoEntitiesAndRelations1653401524226 {
  name = 'RefactorIntoEntitiesAndRelations1653401524226'

  async up(db) {
    await db.query(`CREATE TABLE "evm_network" ("id" character varying NOT NULL, "is_testnet" boolean NOT NULL, "name" text, "explorer_url" text, "rpcs" jsonb NOT NULL, "is_healthy" boolean NOT NULL DEFAULT FALSE, "native_token_id" character varying, "substrate_chain_id" character varying, CONSTRAINT "PK_4add0a78c36c29d8fc0d4cc977b" PRIMARY KEY ("id"))`)
    await db.query(`CREATE INDEX "IDX_f2dba3b2f77ca834efa392e759" ON "evm_network" ("native_token_id") `)
    await db.query(`CREATE INDEX "IDX_d519943ef57ee172387669c64a" ON "evm_network" ("substrate_chain_id") `)
    await db.query(`CREATE TABLE "token" ("id" character varying NOT NULL, "squid_implementation_detail" jsonb NOT NULL, "squid_implementation_detail_chain_id" character varying, "squid_implementation_detail_evm_network_id" character varying, CONSTRAINT "PK_82fae97f905930df5d62a702fc9" PRIMARY KEY ("id"))`)
    await db.query(`CREATE INDEX "IDX_1dd94dc2ffcb3f64c5b37b39cc" ON "token" ("squid_implementation_detail_chain_id") `)
    await db.query(`CREATE INDEX "IDX_4db87827a7d2bfdf54cf799c77" ON "token" ("squid_implementation_detail_evm_network_id") `)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "token"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "decimals"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "existential_deposit"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "tokens"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "native_token"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "coingecko_id"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "rates"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "ethereum_explorer_url"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "ethereum_rpcs"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "ethereum_id"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "ethereum_max_gas_priority_fees"`)
    await db.query(`ALTER TABLE "chain" ADD "native_token_id" character varying`)
    await db.query(`CREATE INDEX "IDX_aabcbc01e325275303ab57d6a0" ON "chain" ("native_token_id") `)
    await db.query(`ALTER TABLE "evm_network" ADD CONSTRAINT "FK_f2dba3b2f77ca834efa392e7591" FOREIGN KEY ("native_token_id") REFERENCES "token"("id") ON DELETE SET NULL ON UPDATE SET NULL`)
    await db.query(`ALTER TABLE "evm_network" ADD CONSTRAINT "FK_d519943ef57ee172387669c64a3" FOREIGN KEY ("substrate_chain_id") REFERENCES "chain"("id") ON DELETE CASCADE ON UPDATE CASCADE`)
    await db.query(`ALTER TABLE "token" ADD CONSTRAINT "FK_1dd94dc2ffcb3f64c5b37b39cca" FOREIGN KEY ("squid_implementation_detail_chain_id") REFERENCES "chain"("id") ON DELETE CASCADE ON UPDATE CASCADE`)
    await db.query(`ALTER TABLE "token" ADD CONSTRAINT "FK_4db87827a7d2bfdf54cf799c77c" FOREIGN KEY ("squid_implementation_detail_evm_network_id") REFERENCES "evm_network"("id") ON DELETE CASCADE ON UPDATE CASCADE`)
    await db.query(`ALTER TABLE "chain" ADD CONSTRAINT "FK_aabcbc01e325275303ab57d6a08" FOREIGN KEY ("native_token_id") REFERENCES "token"("id") ON DELETE SET NULL ON UPDATE SET NULL`)
  }

  async down(db) {
    await db.query(`DROP TABLE "evm_network"`)
    await db.query(`DROP INDEX "public"."IDX_f2dba3b2f77ca834efa392e759"`)
    await db.query(`DROP INDEX "public"."IDX_d519943ef57ee172387669c64a"`)
    await db.query(`DROP TABLE "token"`)
    await db.query(`DROP INDEX "public"."IDX_1dd94dc2ffcb3f64c5b37b39cc"`)
    await db.query(`DROP INDEX "public"."IDX_4db87827a7d2bfdf54cf799c77"`)
    await db.query(`ALTER TABLE "chain" ADD "token" text`)
    await db.query(`ALTER TABLE "chain" ADD "decimals" integer`)
    await db.query(`ALTER TABLE "chain" ADD "existential_deposit" text`)
    await db.query(`ALTER TABLE "chain" ADD "tokens" jsonb`)
    await db.query(`ALTER TABLE "chain" ADD "native_token" jsonb`)
    await db.query(`ALTER TABLE "chain" ADD "coingecko_id" text`)
    await db.query(`ALTER TABLE "chain" ADD "rates" jsonb`)
    await db.query(`ALTER TABLE "chain" ADD "ethereum_explorer_url" text`)
    await db.query(`ALTER TABLE "chain" ADD "ethereum_rpcs" jsonb NOT NULL`)
    await db.query(`ALTER TABLE "chain" ADD "ethereum_id" integer`)
    await db.query(`ALTER TABLE "chain" ADD "ethereum_max_gas_priority_fees" jsonb`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "native_token_id"`)
    await db.query(`DROP INDEX "public"."IDX_aabcbc01e325275303ab57d6a0"`)
    await db.query(`ALTER TABLE "evm_network" DROP CONSTRAINT "FK_f2dba3b2f77ca834efa392e7591"`)
    await db.query(`ALTER TABLE "evm_network" DROP CONSTRAINT "FK_d519943ef57ee172387669c64a3"`)
    await db.query(`ALTER TABLE "token" DROP CONSTRAINT "FK_1dd94dc2ffcb3f64c5b37b39cca"`)
    await db.query(`ALTER TABLE "token" DROP CONSTRAINT "FK_4db87827a7d2bfdf54cf799c77c"`)
    await db.query(`ALTER TABLE "chain" DROP CONSTRAINT "FK_aabcbc01e325275303ab57d6a08"`)
  }
}
