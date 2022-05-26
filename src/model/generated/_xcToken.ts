import assert from "assert"
import * as marshal from "./marshal"
import {TokenRates} from "./_tokenRates"

export class XcToken {
  public readonly isTypeOf = 'XcToken'
  private _id!: string
  private _symbol!: string | undefined | null
  private _decimals!: number | undefined | null
  private _coingeckoId!: string | undefined | null
  private _rates!: TokenRates | undefined | null

  constructor(props?: Partial<Omit<XcToken, 'toJSON'>>, json?: any) {
    Object.assign(this, props)
    if (json != null) {
      this._id = marshal.id.fromJSON(json.id)
      this._symbol = json.symbol == null ? undefined : marshal.string.fromJSON(json.symbol)
      this._decimals = json.decimals == null ? undefined : marshal.int.fromJSON(json.decimals)
      this._coingeckoId = json.coingeckoId == null ? undefined : marshal.string.fromJSON(json.coingeckoId)
      this._rates = json.rates == null ? undefined : new TokenRates(undefined, json.rates)
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

  toJSON(): object {
    return {
      isTypeOf: this.isTypeOf,
      id: this.id,
      symbol: this.symbol,
      decimals: this.decimals,
      coingeckoId: this.coingeckoId,
      rates: this.rates == null ? undefined : this.rates.toJSON(),
    }
  }
}
