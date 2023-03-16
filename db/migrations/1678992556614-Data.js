module.exports = class Data1678992556614 {
  name = 'Data1678992556614'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "theme_color" text`)
    await db.query(`ALTER TABLE "evm_network" ADD "theme_color" text`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "theme_color"`)
    await db.query(`ALTER TABLE "evm_network" DROP COLUMN "theme_color"`)
  }
}
