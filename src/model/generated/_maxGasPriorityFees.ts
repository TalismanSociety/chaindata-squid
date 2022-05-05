import assert from "assert"
import * as marshal from "./marshal"

export class MaxGasPriorityFees {
  private _low!: string
  private _medium!: string
  private _high!: string

  constructor(props?: Partial<Omit<MaxGasPriorityFees, 'toJSON'>>, json?: any) {
    Object.assign(this, props)
    if (json != null) {
      this._low = marshal.string.fromJSON(json.low)
      this._medium = marshal.string.fromJSON(json.medium)
      this._high = marshal.string.fromJSON(json.high)
    }
  }

  /**
   * the recommended max priority fee for low priority transactions - wei/planck units
   */
  get low(): string {
    assert(this._low != null, 'uninitialized access')
    return this._low
  }

  set low(value: string) {
    this._low = value
  }

  /**
   * the recommended max gas priority fee for medium priority transactions - wei/planck units
   */
  get medium(): string {
    assert(this._medium != null, 'uninitialized access')
    return this._medium
  }

  set medium(value: string) {
    this._medium = value
  }

  /**
   * the recommended max gas priority fee for high priority transactions - wei/planck units
   */
  get high(): string {
    assert(this._high != null, 'uninitialized access')
    return this._high
  }

  set high(value: string) {
    this._high = value
  }

  toJSON(): object {
    return {
      low: this.low,
      medium: this.medium,
      high: this.high,
    }
  }
}
