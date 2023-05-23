module.exports = class AddIsUnknownFeeToken1684748755213 {
  name = 'AddIsUnknownFeeToken1684748755213'

  async up(db) {
    await db.query(
      `ALTER TABLE "chain" ADD "is_unknown_fee_token" boolean NOT NULL DEFAULT FALSE`
    )
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "is_unknown_fee_token"`)
  }
}
