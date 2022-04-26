module.exports = class AddEthereumFields1650946497129 {
  name = 'AddEthereumFields1650946497129'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "ethereum_explorer_url" text`)
    await db.query(`ALTER TABLE "chain" ADD "ethereum_rpcs" jsonb NOT NULL`)
    await db.query(`ALTER TABLE "chain" ADD "ethereum_id" integer`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "ethereum_explorer_url"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "ethereum_rpcs"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "ethereum_id"`)
  }
}
