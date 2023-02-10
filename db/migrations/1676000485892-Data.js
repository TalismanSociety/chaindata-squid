module.exports = class Data1676000485892 {
    name = 'Data1676000485892'

    async up(db) {
        await db.query(`ALTER TABLE "chain" ADD "chainspec_qr_url" text`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "chain" DROP COLUMN "chainspec_qr_url"`)
    }
}
