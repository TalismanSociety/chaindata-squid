module.exports = class AddChainIsHealthy1642126925448 {
  name = 'AddChainIsHealthy1642126925448'

  async up(db) {
    await db.query(
      `ALTER TABLE "chain" ADD "is_healthy" boolean NOT NULL DEFAULT FALSE`
    )
  }

  async down(db) {
    await db.query(`ALTER TABLE "chain" DROP COLUMN "is_healthy"`)
  }
}
