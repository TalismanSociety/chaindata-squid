module.exports = class AddChainChainName1642651021607 {
  name = 'AddChainChainName1642651021607'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "chain_name" text`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "chain_name"`)
  }
}
