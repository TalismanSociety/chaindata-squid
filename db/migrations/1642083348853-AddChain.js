module.exports = class AddChain1642083348853 {
  name = 'AddChain1642083348853'

  async up(db) {
    await db.query(`CREATE TABLE "chain" ("id" character varying NOT NULL, "para_id" integer, "genesis_hash" text, "prefix" integer, "name" text, "token" text, "decimals" integer, "existential_deposit" text, "account" text, "rpcs" text array NOT NULL, "relay_id" character varying, CONSTRAINT "PK_8e273aafae283b886672c952ecd" PRIMARY KEY ("id"))`)
    await db.query(`CREATE INDEX "IDX_f04a59a185140a1ad041ee511c" ON "chain" ("relay_id") `)
    await db.query(`ALTER TABLE "chain" ADD CONSTRAINT "FK_f04a59a185140a1ad041ee511cd" FOREIGN KEY ("relay_id") REFERENCES "chain"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
  }

  async down(db) {
    await db.query(`DROP TABLE "chain"`)
    await db.query(`DROP INDEX "public"."IDX_f04a59a185140a1ad041ee511c"`)
    await db.query(`ALTER TABLE "chain" DROP CONSTRAINT "FK_f04a59a185140a1ad041ee511cd"`)
  }
}
