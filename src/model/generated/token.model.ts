import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import {Chain} from "./chain.model"
import {EvmNetwork} from "./evmNetwork.model"

@Entity_()
export class Token {
  constructor(props?: Partial<Token>) {
    Object.assign(this, props)
  }

  /**
   * talisman-defined id for this token
   */
  @PrimaryColumn_()
  id!: string

  /**
   * TODO: Put all token data into here (because we have plugins now)
   */
  @Column_("jsonb", {nullable: true})
  data!: unknown | undefined | null

  /**
   * implementation detail for relation lookups, can be removed once https://github.com/subsquid/squid/issues/41 is merged
   */
  @OneToMany_(() => Chain, e => e.nativeToken)
  squidImplementationDetailNativeToChains!: Chain[]

  /**
   * implementation detail for relation lookups, can be removed once https://github.com/subsquid/squid/issues/41 is merged
   */
  @OneToMany_(() => EvmNetwork, e => e.nativeToken)
  squidImplementationDetailNativeToEvmNetworks!: EvmNetwork[]

  /**
   * implementation detail for relation lookups, can be removed once https://github.com/subsquid/squid/issues/41 is merged
   */
  @Index_()
  @ManyToOne_(() => Chain, {nullable: true})
  squidImplementationDetailChain!: Chain | undefined | null

  /**
   * implementation detail for relation lookups, can be removed once https://github.com/subsquid/squid/issues/41 is merged
   */
  @Index_()
  @ManyToOne_(() => EvmNetwork, {nullable: true})
  squidImplementationDetailEvmNetwork!: EvmNetwork | undefined | null
}
