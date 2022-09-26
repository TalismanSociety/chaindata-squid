module.exports = class Data1663681136888 {
  name = 'Data1663681136888'

  async up(db) {
    await db.query(`ALTER TABLE "token" DROP COLUMN "squid_implementation_detail"`)
    await db.query(`ALTER TABLE "token" ADD "data" jsonb NOT NULL`)
    await db.query(`ALTER TABLE "evm_network" ADD "balance_metadata" jsonb NOT NULL`)
    await db.query(`ALTER TABLE "chain" ADD "balance_metadata" jsonb NOT NULL`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "token" DROP COLUMN "data"`)
    await db.query(`ALTER TABLE "token" ADD "squid_implementation_detail" jsonb NOT NULL`)
    await db.query(`ALTER TABLE "evm_network" DROP COLUMN "balance_metadata"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "balance_metadata"`)
  }
}
