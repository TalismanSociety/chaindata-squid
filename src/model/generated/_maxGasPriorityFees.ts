import assert from "assert"
import * as marshal from "./marshal"

export class MaxGasPriorityFees {
  private _low!: string
  private _normal!: string
  private _high!: string

  constructor(props?: Partial<Omit<MaxGasPriorityFees, 'toJSON'>>, json?: any) {
    Object.assign(this, props)
    if (json != null) {
      this._low = marshal.string.fromJSON(json.low)
      this._normal = marshal.string.fromJSON(json.normal)
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
   * the recommended max gas priority fee for normal priority transactions - wei/planck units
   */
  get normal(): string {
    assert(this._normal != null, 'uninitialized access')
    return this._normal
  }

  set normal(value: string) {
    this._normal = value
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
      normal: this.normal,
      high: this.high,
    }
  }
}
