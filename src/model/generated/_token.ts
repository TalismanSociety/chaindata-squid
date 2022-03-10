import assert from "assert"
import * as marshal from "./marshal"

export class Token {
  private _index!: number | undefined | null
  private _token!: string | undefined | null
  private _decimals!: number | undefined | null
  private _existentialDeposit!: string | undefined | null

  constructor(props?: Partial<Omit<Token, 'toJSON'>>, json?: any) {
    Object.assign(this, props)
    if (json != null) {
      this._index = json.index == null ? undefined : marshal.int.fromJSON(json.index)
      this._token = json.token == null ? undefined : marshal.string.fromJSON(json.token)
      this._decimals = json.decimals == null ? undefined : marshal.int.fromJSON(json.decimals)
      this._existentialDeposit = json.existentialDeposit == null ? undefined : marshal.string.fromJSON(json.existentialDeposit)
    }
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

  toJSON(): object {
    return {
      index: this.index,
      token: this.token,
      decimals: this.decimals,
      existentialDeposit: this.existentialDeposit,
    }
  }
}
