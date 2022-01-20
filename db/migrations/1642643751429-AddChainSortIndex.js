module.exports = class AddChainSortIndex1642643751429 {
  name = 'AddChainSortIndex1642643751429'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "sort_index" integer`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "sort_index"`)
  }
}
