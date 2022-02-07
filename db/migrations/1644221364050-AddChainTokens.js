module.exports = class AddChainTokens1644221364050 {
  name = 'AddChainTokens1644221364050'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "tokens" jsonb`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "tokens"`)
  }
}
