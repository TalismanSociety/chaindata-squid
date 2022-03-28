module.exports = class AddChainNativeTokenRates1647494581415 {
  name = 'AddChainNativeTokenRates1647494581415'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "native_token" jsonb`)
    await db.query(`ALTER TABLE "chain" ADD "coingecko_id" text`)
    await db.query(`ALTER TABLE "chain" ADD "rates" jsonb`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "native_token"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "coingecko_id"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "rates"`)
  }
}
