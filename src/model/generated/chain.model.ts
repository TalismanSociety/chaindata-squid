import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, OneToMany as OneToMany_} from "typeorm"
import * as marshal from "./marshal"
import {Token} from "./token.model"
import {SubstrateRpc} from "./_substrateRpc"
import {BalanceModuleMetadata} from "./_balanceModuleMetadata"
import {BalanceModuleConfig} from "./_balanceModuleConfig"
import {EvmNetwork} from "./evmNetwork.model"

@Entity_()
export class Chain {
    constructor(props?: Partial<Chain>) {
        Object.assign(this, props)
    }

    /**
     * the id for this chain (talisman-defined)
     */
    @PrimaryColumn_()
    id!: string

    /**
     * is chain this a testnet?
     */
    @Column_("bool", {nullable: false})
    isTestnet!: boolean

    /**
     * index for sorting chains and evm networks in a user-friendly way
     */
    @Column_("int4", {nullable: true})
    sortIndex!: number | undefined | null

    /**
     * hash of the first block on this chain
     */
    @Column_("text", {nullable: true})
    genesisHash!: string | undefined | null

    /**
     * ss58 prefix for this chain
     */
    @Column_("int4", {nullable: true})
    prefix!: number | undefined | null

    /**
     * talisman-defined name for this chain
     */
    @Column_("text", {nullable: true})
    name!: string | undefined | null

    /**
     * a theme color for this chain
     */
    @Column_("text", {nullable: true})
    themeColor!: string | undefined | null

    /**
     * url of the logo for this chain
     */
    @Column_("text", {nullable: true})
    logo!: string | undefined | null

    /**
     * chain-specified name for this chain
     */
    @Column_("text", {nullable: true})
    chainName!: string | undefined | null

    /**
     * implementation name for this chain
     */
    @Column_("text", {nullable: true})
    implName!: string | undefined | null

    /**
     * specification name for this chain
     */
    @Column_("text", {nullable: true})
    specName!: string | undefined | null

    /**
     * specification version for this chain
     */
    @Column_("text", {nullable: true})
    specVersion!: string | undefined | null

    /**
     * native token for this chain
     */
    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    nativeToken!: Token | undefined | null

    /**
     * whether this chain uses has custom rules to decide on fee token
     */
    @Column_("bool", {nullable: true})
    isUnknownFeeToken!: boolean | undefined | null

    /**
     * other tokens on this chain
     */
    @OneToMany_(() => Token, e => e.squidImplementationDetailChain)
    tokens!: Token[]

    /**
     * account format for this chain
     */
    @Column_("text", {nullable: true})
    account!: string | undefined | null

    /**
     * subscan endpoint for this chain
     */
    @Column_("text", {nullable: true})
    subscanUrl!: string | undefined | null

    /**
     * chainspec qr url for this chain
     */
    @Column_("text", {nullable: true})
    chainspecQrUrl!: string | undefined | null

    /**
     * latest metadata qr url for this chain
     */
    @Column_("text", {nullable: true})
    latestMetadataQrUrl!: string | undefined | null

    /**
     * substrate rpcs for this chain (talisman-defined)
     */
    @Column_("jsonb", {transformer: {to: obj => obj.map((val: any) => val.toJSON()), from: obj => obj == null ? undefined : marshal.fromList(obj, val => new SubstrateRpc(undefined, marshal.nonNull(val)))}, nullable: false})
    rpcs!: (SubstrateRpc)[]

    /**
     * health status for this chain
     */
    @Column_("bool", {nullable: false})
    isHealthy!: boolean

    /**
     * balance metadata for this chain
     */
    @Column_("jsonb", {transformer: {to: obj => obj.map((val: any) => val.toJSON()), from: obj => obj == null ? undefined : marshal.fromList(obj, val => new BalanceModuleMetadata(undefined, marshal.nonNull(val)))}, nullable: false})
    balanceMetadata!: (BalanceModuleMetadata)[]

    /**
     * balance module configs for this chain
     */
    @Column_("jsonb", {transformer: {to: obj => obj.map((val: any) => val.toJSON()), from: obj => obj == null ? undefined : marshal.fromList(obj, val => new BalanceModuleConfig(undefined, marshal.nonNull(val)))}, nullable: false})
    balanceModuleConfigs!: (BalanceModuleConfig)[]

    /**
     * evm networks on this chain
     */
    @OneToMany_(() => EvmNetwork, e => e.substrateChain)
    evmNetworks!: EvmNetwork[]

    /**
     * parathreads of this chain (if this chain is a relaychain)
     */
    @OneToMany_(() => Chain, e => e.relay)
    parathreads!: Chain[]

    /**
     * paraId for this chain (if this chain is a parachain for another chain)
     */
    @Column_("int4", {nullable: true})
    paraId!: number | undefined | null

    /**
     * relaychain of this chain (if this chain is a parachain for another chain)
     */
    @Index_()
    @ManyToOne_(() => Chain, {nullable: true})
    relay!: Chain | undefined | null
}
