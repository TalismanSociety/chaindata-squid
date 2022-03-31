import assert from "assert"
import * as marshal from "./marshal"
import {Rates} from "./_rates"

export class Token {
  private _id!: string
  private _index!: number | undefined | null
  private _token!: string | undefined | null
  private _decimals!: number | undefined | null
  private _existentialDeposit!: string | undefined | null
  private _coingeckoId!: string | undefined | null
  private _rates!: Rates | undefined | null

  constructor(props?: Partial<Omit<Token, 'toJSON'>>, json?: any) {
    Object.assign(this, props)
    if (json != null) {
      this._id = marshal.id.fromJSON(json.id)
      this._index = json.index == null ? undefined : marshal.int.fromJSON(json.index)
      this._token = json.token == null ? undefined : marshal.string.fromJSON(json.token)
      this._decimals = json.decimals == null ? undefined : marshal.int.fromJSON(json.decimals)
      this._existentialDeposit = json.existentialDeposit == null ? undefined : marshal.string.fromJSON(json.existentialDeposit)
      this._coingeckoId = json.coingeckoId == null ? undefined : marshal.string.fromJSON(json.coingeckoId)
      this._rates = json.rates == null ? undefined : new Rates(undefined, json.rates)
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
   * the on-chain TokenSymbol index of this token
   */
  get index(): number | undefined | null {
    return this._index
  }

  set index(value: number | undefined | null) {
    this._index = value
  }

  /**
   * token symbol
   */
  get token(): string | undefined | null {
    return this._token
  }

  set token(value: string | undefined | null) {
    this._token = value
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
   * minimum tokens per account
   */
  get existentialDeposit(): string | undefined | null {
    return this._existentialDeposit
  }

  set existentialDeposit(value: string | undefined | null) {
    this._existentialDeposit = value
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
   * rates for this token
   */
  get rates(): Rates | undefined | null {
    return this._rates
  }

  set rates(value: Rates | undefined | null) {
    this._rates = value
  }

  toJSON(): object {
    return {
      id: this.id,
      index: this.index,
      token: this.token,
      decimals: this.decimals,
      existentialDeposit: this.existentialDeposit,
      coingeckoId: this.coingeckoId,
      rates: this.rates == null ? undefined : this.rates.toJSON(),
    }
  }
}
