module.exports = class AddChainIsTestnet1644801194674 {
  name = 'AddChainIsTestnet1644801194674'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "is_testnet" boolean NOT NULL`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "is_testnet"`)
  }
}
