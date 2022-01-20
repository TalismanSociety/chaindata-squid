module.exports = class AddChainImplNameSpecName1642640844406 {
  name = 'AddChainImplNameSpecName1642640844406'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "impl_name" text`)
    await db.query(`ALTER TABLE "chain" ADD "spec_name" text`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "impl_name"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "spec_name"`)
  }
}
