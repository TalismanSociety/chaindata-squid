module.exports = class Data1675880947128 {
    name = 'Data1675880947128'

    async up(db) {
        await db.query(`ALTER TABLE "chain" ADD "latest_metadata_qr_url" text`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "chain" DROP COLUMN "latest_metadata_qr_url"`)
    }
}
