import assert from "assert"
import * as marshal from "./marshal"

export class EthereumRpc {
    private _url!: string
    private _isHealthy!: boolean

    constructor(props?: Partial<Omit<EthereumRpc, 'toJSON'>>, json?: any) {
        Object.assign(this, props)
        if (json != null) {
            this._url = marshal.string.fromJSON(json.url)
            this._isHealthy = marshal.boolean.fromJSON(json.isHealthy)
        }
    }

    /**
     * url of this ethereum rpc
     */
    get url(): string {
        assert(this._url != null, 'uninitialized access')
        return this._url
    }

    set url(value: string) {
        this._url = value
    }

    /**
     * health status of this ethereum rpc
     */
    get isHealthy(): boolean {
        assert(this._isHealthy != null, 'uninitialized access')
        return this._isHealthy
    }

    set isHealthy(value: boolean) {
        this._isHealthy = value
    }

    toJSON(): object {
        return {
            url: this.url,
            isHealthy: this.isHealthy,
        }
    }
}
