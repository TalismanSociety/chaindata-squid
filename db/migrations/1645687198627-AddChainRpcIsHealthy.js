module.exports = class AddChainRpcIsHealthy1645687198627 {
  name = 'AddChainRpcIsHealthy1645687198627'

  async up(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "rpcs"`)
    await db.query(`ALTER TABLE "chain" ADD "rpcs" jsonb NOT NULL`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "rpcs"`)
    await db.query(`ALTER TABLE "chain" ADD "rpcs" text array NOT NULL`)
  }
}
