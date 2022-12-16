import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, OneToMany as OneToMany_} from "typeorm"
import * as marshal from "./marshal"
import {Token} from "./token.model"
import {EthereumRpc} from "./_ethereumRpc"
import {BalanceModuleMetadata} from "./_balanceModuleMetadata"
import {BalanceModuleConfig} from "./_balanceModuleConfig"
import {Chain} from "./chain.model"

@Entity_()
export class EvmNetwork {
    constructor(props?: Partial<EvmNetwork>) {
        Object.assign(this, props)
    }

    /**
     * the chain identifier used for signing ethereum transactions
     */
    @PrimaryColumn_()
    id!: string

    /**
     * is this network a testnet?
     */
    @Column_("bool", {nullable: false})
    isTestnet!: boolean

    /**
     * index for sorting chains and evm networks in a user-friendly way
     */
    @Column_("int4", {nullable: true})
    sortIndex!: number | undefined | null

    /**
     * talisman-defined name for this network
     */
    @Column_("text", {nullable: true})
    name!: string | undefined | null

    /**
     * url of the logo for this network
     */
    @Column_("text", {nullable: true})
    logo!: string | undefined | null

    /**
     * native token for this network
     */
    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    nativeToken!: Token | undefined | null

    /**
     * other tokens on this network
     */
    @OneToMany_(() => Token, e => e.squidImplementationDetailEvmNetwork)
    tokens!: Token[]

    /**
     * block explorer url for this network
     */
    @Column_("text", {nullable: true})
    explorerUrl!: string | undefined | null

    /**
     * talisman-defined ethereum rpcs for this network
     */
    @Column_("jsonb", {transformer: {to: obj => obj.map((val: any) => val.toJSON()), from: obj => obj == null ? undefined : marshal.fromList(obj, val => new EthereumRpc(undefined, marshal.nonNull(val)))}, nullable: false})
    rpcs!: (EthereumRpc)[]

    /**
     * health status of this network
     */
    @Column_("bool", {nullable: false})
    isHealthy!: boolean

    /**
     * balance metadata for this network
     */
    @Column_("jsonb", {transformer: {to: obj => obj.map((val: any) => val.toJSON()), from: obj => obj == null ? undefined : marshal.fromList(obj, val => new BalanceModuleMetadata(undefined, marshal.nonNull(val)))}, nullable: false})
    balanceMetadata!: (BalanceModuleMetadata)[]

    /**
     * balance module configs for this network
     */
    @Column_("jsonb", {transformer: {to: obj => obj.map((val: any) => val.toJSON()), from: obj => obj == null ? undefined : marshal.fromList(obj, val => new BalanceModuleConfig(undefined, marshal.nonNull(val)))}, nullable: false})
    balanceModuleConfigs!: (BalanceModuleConfig)[]

    /**
     * substrate chain this evm network runs on
     */
    @Index_()
    @ManyToOne_(() => Chain, {nullable: true})
    substrateChain!: Chain | undefined | null
}
