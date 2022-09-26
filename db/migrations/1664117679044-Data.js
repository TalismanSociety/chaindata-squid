module.exports = class Data1664117679044 {
  name = 'Data1664117679044'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "logo" text`)
    await db.query(`ALTER TABLE "evm_network" ADD "logo" text`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "logo"`)
    await db.query(`ALTER TABLE "evm_network" DROP COLUMN "logo"`)
  }
}
