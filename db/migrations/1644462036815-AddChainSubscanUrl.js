module.exports = class AddChainSubscanUrl1644462036815 {
  name = 'AddChainSubscanUrl1644462036815'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "subscan_url" text`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "subscan_url"`)
  }
}
