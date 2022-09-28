module.exports = class Data1664386624295 {
  name = 'Data1664386624295'

  async up(db) {
    await db.query(`ALTER TABLE "evm_network" ADD "balance_module_configs" jsonb NOT NULL`)
    await db.query(`ALTER TABLE "chain" ADD "balance_module_configs" jsonb NOT NULL`)
  }

  async down(db) {
    await db.query(`ALTER TABLE "evm_network" DROP COLUMN "balance_module_configs"`)
    await db.query(`ALTER TABLE "chain" DROP COLUMN "balance_module_configs"`)
  }
}
