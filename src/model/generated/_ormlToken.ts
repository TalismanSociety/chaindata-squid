import assert from "assert"
import * as marshal from "./marshal"
import {TokenRates} from "./_tokenRates"
import {Chain} from "./chain.model"

export class OrmlToken {
  public readonly isTypeOf = 'OrmlToken'
  private _id!: string
  private _symbol!: string | undefined | null
  private _decimals!: number | undefined | null
  private _coingeckoId!: string | undefined | null
  private _rates!: TokenRates | undefined | null
  private _existentialDeposit!: bigint | undefined | null
  private _index!: number | undefined | null
  private _chain!: string | undefined | null

  constructor(props?: Partial<Omit<OrmlToken, 'toJSON'>>, json?: any) {
    Object.assign(this, props)
    if (json != null) {
      this._id = marshal.id.fromJSON(json.id)
      this._symbol = json.symbol == null ? undefined : marshal.string.fromJSON(json.symbol)
      this._decimals = json.decimals == null ? undefined : marshal.int.fromJSON(json.decimals)
      this._coingeckoId = json.coingeckoId == null ? undefined : marshal.string.fromJSON(json.coingeckoId)
      this._rates = json.rates == null ? undefined : new TokenRates(undefined, json.rates)
      this._existentialDeposit = json.existentialDeposit == null ? undefined : marshal.bigint.fromJSON(json.existentialDeposit)
      this._index = json.index == null ? undefined : marshal.int.fromJSON(json.index)
      this._chain = json.chain == null ? undefined : marshal.string.fromJSON(json.chain)
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
   * minimum tokens per account
   */
  get existentialDeposit(): bigint | undefined | null {
    return this._existentialDeposit
  }

  set existentialDeposit(value: bigint | undefined | null) {
    this._existentialDeposit = value
  }

  /**
   * the on-chain TokenSymbol index of this token
   */
  get index(): number | undefined | null {
    return this._index
  }

  set index(value: number | undefined | null) {
    this._index = value
  }

  /**
   * substrate chain this token is an orml token on
   */
  get chain(): string | undefined | null {
    return this._chain
  }

  set chain(value: string | undefined | null) {
    this._chain = value
  }

  toJSON(): object {
    return {
      isTypeOf: this.isTypeOf,
      id: this.id,
      symbol: this.symbol,
      decimals: this.decimals,
      coingeckoId: this.coingeckoId,
      rates: this.rates == null ? undefined : this.rates.toJSON(),
      existentialDeposit: this.existentialDeposit == null ? undefined : marshal.bigint.toJSON(this.existentialDeposit),
      index: this.index,
      chain: this.chain,
    }
  }
}
