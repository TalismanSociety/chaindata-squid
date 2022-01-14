import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"

@Entity_()
export class Chain {
  constructor(props?: Partial<Chain>) {
    Object.assign(this, props)
  }

  /**
   * Network identifier
   */
  @PrimaryColumn_()
  id!: string

  @Column_("text", {nullable: true})
  genesisHash!: string | undefined | null

  @Column_("integer", {nullable: true})
  prefix!: number | undefined | null

  @Column_("text", {nullable: true})
  name!: string | undefined | null

  @Column_("text", {nullable: true})
  token!: string | undefined | null

  @Column_("integer", {nullable: true})
  decimals!: number | undefined | null

  @Column_("text", {nullable: true})
  existentialDeposit!: string | undefined | null

  @Column_("text", {nullable: true})
  account!: string | undefined | null

  @Column_("text", {array: true, nullable: false})
  rpcs!: (string)[]

  @Column_("bool", {nullable: false})
  isHealthy!: boolean

  @OneToMany_(() => Chain, e => e.relay)
  parathreads!: Chain[]

  @Column_("integer", {nullable: true})
  paraId!: number | undefined | null

  @Index_()
  @ManyToOne_(() => Chain, {nullable: true})
  relay!: Chain | undefined | null
}
