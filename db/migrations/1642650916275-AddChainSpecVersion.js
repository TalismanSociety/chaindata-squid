module.exports = class AddChainSpecVersion1642650916275 {
  name = 'AddChainSpecVersion1642650916275'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "spec_version" text`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "spec_version"`)
  }
}
