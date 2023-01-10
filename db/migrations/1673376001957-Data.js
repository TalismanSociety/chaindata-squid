module.exports = class Data1673376001957 {
    name = 'Data1673376001957'

    async up(db) {
        await db.query(`CREATE TABLE "cached_coingecko_logo" ("id" character varying NOT NULL, "url" text NOT NULL, "last_updated" text NOT NULL, CONSTRAINT "PK_ec1e048c7ac401b8d8dfcba4d73" PRIMARY KEY ("id"))`)
    }

    async down(db) {
        await db.query(`DROP TABLE "cached_coingecko_logo"`)
    }
}
