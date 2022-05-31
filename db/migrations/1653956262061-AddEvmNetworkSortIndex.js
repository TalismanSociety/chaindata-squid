module.exports = class AddEvmNetworkSortIndex1653956262061 {
  name = 'AddEvmNetworkSortIndex1653956262061'

  async up(db) {
    await db.query(`ALTER TABLE "evm_network" ADD "sort_index" integer`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "evm_network" DROP COLUMN "sort_index"`)
  }
}
