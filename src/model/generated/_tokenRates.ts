import assert from "assert"
import * as marshal from "./marshal"

export class TokenRates {
  private _usd!: number | undefined | null
  private _aud!: number | undefined | null
  private _nzd!: number | undefined | null
  private _cud!: number | undefined | null
  private _hkd!: number | undefined | null
  private _eur!: number | undefined | null
  private _gbp!: number | undefined | null
  private _jpy!: number | undefined | null
  private _krw!: number | undefined | null
  private _cny!: number | undefined | null
  private _btc!: number | undefined | null
  private _eth!: number | undefined | null
  private _dot!: number | undefined | null

  constructor(props?: Partial<Omit<TokenRates, 'toJSON'>>, json?: any) {
    Object.assign(this, props)
    if (json != null) {
      this._usd = json.usd == null ? undefined : marshal.float.fromJSON(json.usd)
      this._aud = json.aud == null ? undefined : marshal.float.fromJSON(json.aud)
      this._nzd = json.nzd == null ? undefined : marshal.float.fromJSON(json.nzd)
      this._cud = json.cud == null ? undefined : marshal.float.fromJSON(json.cud)
      this._hkd = json.hkd == null ? undefined : marshal.float.fromJSON(json.hkd)
      this._eur = json.eur == null ? undefined : marshal.float.fromJSON(json.eur)
      this._gbp = json.gbp == null ? undefined : marshal.float.fromJSON(json.gbp)
      this._jpy = json.jpy == null ? undefined : marshal.float.fromJSON(json.jpy)
      this._krw = json.krw == null ? undefined : marshal.float.fromJSON(json.krw)
      this._cny = json.cny == null ? undefined : marshal.float.fromJSON(json.cny)
      this._btc = json.btc == null ? undefined : marshal.float.fromJSON(json.btc)
      this._eth = json.eth == null ? undefined : marshal.float.fromJSON(json.eth)
      this._dot = json.dot == null ? undefined : marshal.float.fromJSON(json.dot)
    }
  }

  /**
   * us dollar rate
   */
  get usd(): number | undefined | null {
    return this._usd
  }

  set usd(value: number | undefined | null) {
    this._usd = value
  }

  /**
   * australian dollar rate
   */
  get aud(): number | undefined | null {
    return this._aud
  }

  set aud(value: number | undefined | null) {
    this._aud = value
  }

  /**
   * new zealand dollar rate
   */
  get nzd(): number | undefined | null {
    return this._nzd
  }

  set nzd(value: number | undefined | null) {
    this._nzd = value
  }

  /**
   * canadian dollar rate
   */
  get cud(): number | undefined | null {
    return this._cud
  }

  set cud(value: number | undefined | null) {
    this._cud = value
  }

  /**
   * hong kong dollar rate
   */
  get hkd(): number | undefined | null {
    return this._hkd
  }

  set hkd(value: number | undefined | null) {
    this._hkd = value
  }

  /**
   * euro rate
   */
  get eur(): number | undefined | null {
    return this._eur
  }

  set eur(value: number | undefined | null) {
    this._eur = value
  }

  /**
   * british pound sterling rate
   */
  get gbp(): number | undefined | null {
    return this._gbp
  }

  set gbp(value: number | undefined | null) {
    this._gbp = value
  }

  /**
   * japanese yen rate
   */
  get jpy(): number | undefined | null {
    return this._jpy
  }

  set jpy(value: number | undefined | null) {
    this._jpy = value
  }

  /**
   * south korean won rate
   */
  get krw(): number | undefined | null {
    return this._krw
  }

  set krw(value: number | undefined | null) {
    this._krw = value
  }

  /**
   * chinese yuan rate
   */
  get cny(): number | undefined | null {
    return this._cny
  }

  set cny(value: number | undefined | null) {
    this._cny = value
  }

  /**
   * btc rate
   */
  get btc(): number | undefined | null {
    return this._btc
  }

  set btc(value: number | undefined | null) {
    this._btc = value
  }

  /**
   * eth rate
   */
  get eth(): number | undefined | null {
    return this._eth
  }

  set eth(value: number | undefined | null) {
    this._eth = value
  }

  /**
   * dot rate
   */
  get dot(): number | undefined | null {
    return this._dot
  }

  set dot(value: number | undefined | null) {
    this._dot = value
  }

  toJSON(): object {
    return {
      usd: this.usd,
      aud: this.aud,
      nzd: this.nzd,
      cud: this.cud,
      hkd: this.hkd,
      eur: this.eur,
      gbp: this.gbp,
      jpy: this.jpy,
      krw: this.krw,
      cny: this.cny,
      btc: this.btc,
      eth: this.eth,
      dot: this.dot,
    }
  }
}
