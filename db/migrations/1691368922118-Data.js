module.exports = class Data1691368922118 {
  name = 'Data1691368922118'

  async up(db) {
    await db.query(`CREATE INDEX "IDX_9b10dc8ec061d5d8327080c6b2" ON "chain" ("genesis_hash") `)
  }

  async down(db) {
    await db.query(`DROP INDEX "public"."IDX_9b10dc8ec061d5d8327080c6b2"`)
  }
}
