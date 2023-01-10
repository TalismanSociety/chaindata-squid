import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_} from "typeorm"

@Entity_()
export class CachedCoingeckoLogo {
    constructor(props?: Partial<CachedCoingeckoLogo>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("text", {nullable: false})
    url!: string

    @Column_("text", {nullable: false})
    lastUpdated!: string
}
