import assert from "assert"
import * as marshal from "./marshal"

export class BalanceModuleConfig {
    private _moduleType!: string
    private _moduleConfig!: unknown

    constructor(props?: Partial<Omit<BalanceModuleConfig, 'toJSON'>>, json?: any) {
        Object.assign(this, props)
        if (json != null) {
            this._moduleType = marshal.string.fromJSON(json.moduleType)
            this._moduleConfig = json.moduleConfig
        }
    }

    get moduleType(): string {
        assert(this._moduleType != null, 'uninitialized access')
        return this._moduleType
    }

    set moduleType(value: string) {
        this._moduleType = value
    }

    get moduleConfig(): unknown {
        assert(this._moduleConfig != null, 'uninitialized access')
        return this._moduleConfig
    }

    set moduleConfig(value: unknown) {
        this._moduleConfig = value
    }

    toJSON(): object {
        return {
            moduleType: this.moduleType,
            moduleConfig: this.moduleConfig,
        }
    }
}
