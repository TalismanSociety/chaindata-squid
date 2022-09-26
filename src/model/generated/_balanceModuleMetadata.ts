import assert from "assert"
import * as marshal from "./marshal"

export class BalanceModuleMetadata {
  private _moduleType!: string
  private _metadata!: unknown

  constructor(props?: Partial<Omit<BalanceModuleMetadata, 'toJSON'>>, json?: any) {
    Object.assign(this, props)
    if (json != null) {
      this._moduleType = marshal.string.fromJSON(json.moduleType)
      this._metadata = json.metadata
    }
  }

  get moduleType(): string {
    assert(this._moduleType != null, 'uninitialized access')
    return this._moduleType
  }

  set moduleType(value: string) {
    this._moduleType = value
  }

  get metadata(): unknown {
    assert(this._metadata != null, 'uninitialized access')
    return this._metadata
  }

  set metadata(value: unknown) {
    this._metadata = value
  }

  toJSON(): object {
    return {
      moduleType: this.moduleType,
      metadata: this.metadata,
    }
  }
}
