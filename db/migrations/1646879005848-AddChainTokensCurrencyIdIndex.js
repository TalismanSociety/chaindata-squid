module.exports = class AddChainTokensCurrencyIdIndex1646879005848 {
  name = 'AddChainTokensCurrencyIdIndex1646879005848'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "tokens_currency_id_index" integer`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "tokens_currency_id_index"`)
  }
}
