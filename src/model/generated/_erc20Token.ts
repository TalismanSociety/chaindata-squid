import assert from "assert"
import * as marshal from "./marshal"
import {TokenRates} from "./_tokenRates"
import {Chain} from "./chain.model"
import {EvmNetwork} from "./evmNetwork.model"

export class Erc20Token {
  public readonly isTypeOf = 'Erc20Token'
  private _id!: string
  private _isTestnet!: boolean
  private _symbol!: string | undefined | null
  private _decimals!: number | undefined | null
  private _coingeckoId!: string | undefined | null
  private _rates!: TokenRates | undefined | null
  private _contractAddress!: string | undefined | null
  private _chain!: string | undefined | null
  private _evmNetwork!: string | undefined | null

  constructor(props?: Partial<Omit<Erc20Token, 'toJSON'>>, json?: any) {
    Object.assign(this, props)
    if (json != null) {
      this._id = marshal.id.fromJSON(json.id)
      this._isTestnet = marshal.boolean.fromJSON(json.isTestnet)
      this._symbol = json.symbol == null ? undefined : marshal.string.fromJSON(json.symbol)
      this._decimals = json.decimals == null ? undefined : marshal.int.fromJSON(json.decimals)
      this._coingeckoId = json.coingeckoId == null ? undefined : marshal.string.fromJSON(json.coingeckoId)
      this._rates = json.rates == null ? undefined : new TokenRates(undefined, json.rates)
      this._contractAddress = json.contractAddress == null ? undefined : marshal.string.fromJSON(json.contractAddress)
      this._chain = json.chain == null ? undefined : marshal.string.fromJSON(json.chain)
      this._evmNetwork = json.evmNetwork == null ? undefined : marshal.string.fromJSON(json.evmNetwork)
    }
  }

  /**
   * talisman-defined id for this token
   */
  get id(): string {
    assert(this._id != null, 'uninitialized access')
    return this._id
  }

  set id(value: string) {
    this._id = value
  }

  /**
   * is this a testnet token?
   */
  get isTestnet(): boolean {
    assert(this._isTestnet != null, 'uninitialized access')
    return this._isTestnet
  }

  set isTestnet(value: boolean) {
    this._isTestnet = value
  }

  /**
   * token symbol
   */
  get symbol(): string | undefined | null {
    return this._symbol
  }

  set symbol(value: string | undefined | null) {
    this._symbol = value
  }

  /**
   * token decimals
   */
  get decimals(): number | undefined | null {
    return this._decimals
  }

  set decimals(value: number | undefined | null) {
    this._decimals = value
  }

  /**
   * coingecko id for this token
   */
  get coingeckoId(): string | undefined | null {
    return this._coingeckoId
  }

  set coingeckoId(value: string | undefined | null) {
    this._coingeckoId = value
  }

  /**
   * fiat/btc/eth/dot rates for this token
   */
  get rates(): TokenRates | undefined | null {
    return this._rates
  }

  set rates(value: TokenRates | undefined | null) {
    this._rates = value
  }

  /**
   * on-chain erc20 contract address of this token
   */
  get contractAddress(): string | undefined | null {
    return this._contractAddress
  }

  set contractAddress(value: string | undefined | null) {
    this._contractAddress = value
  }

  /**
   * substrate chain this token is on
   */
  get chain(): string | undefined | null {
    return this._chain
  }

  set chain(value: string | undefined | null) {
    this._chain = value
  }

  /**
   * evm network this token is on
   */
  get evmNetwork(): string | undefined | null {
    return this._evmNetwork
  }

  set evmNetwork(value: string | undefined | null) {
    this._evmNetwork = value
  }

  toJSON(): object {
    return {
      isTypeOf: this.isTypeOf,
      id: this.id,
      isTestnet: this.isTestnet,
      symbol: this.symbol,
      decimals: this.decimals,
      coingeckoId: this.coingeckoId,
      rates: this.rates == null ? undefined : this.rates.toJSON(),
      contractAddress: this.contractAddress,
      chain: this.chain,
      evmNetwork: this.evmNetwork,
    }
  }
}
