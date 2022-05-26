import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {SquidImplementationDetail, fromJsonSquidImplementationDetail} from "./_squidImplementationDetail"
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
   * implementation detail, can be removed once https://github.com/subsquid/squid/issues/41 is merged
   */
  @Column_("jsonb", {transformer: {to: obj => obj.toJSON(), from: obj => fromJsonSquidImplementationDetail(obj)}, nullable: false})
  squidImplementationDetail!: SquidImplementationDetail

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
