module.exports = class AddChainEthereumMaxGasPriorityFees1651723416199 {
  name = 'AddChainEthereumMaxGasPriorityFees1651723416199'

  async up(db) {
    await db.query(`ALTER TABLE "chain" ADD "ethereum_max_gas_priority_fees" jsonb`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "ethereum_max_gas_priority_fees"`)
  }
}
