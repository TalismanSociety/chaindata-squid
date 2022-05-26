import {NativeToken} from "./_nativeToken"
import {OrmlToken} from "./_ormlToken"
import {LiquidCrowdloanToken} from "./_liquidCrowdloanToken"
import {LiquidityProviderToken} from "./_liquidityProviderToken"
import {XcToken} from "./_xcToken"
import {Erc20Token} from "./_erc20Token"

export type SquidImplementationDetail = NativeToken | OrmlToken | LiquidCrowdloanToken | LiquidityProviderToken | XcToken | Erc20Token

export function fromJsonSquidImplementationDetail(json: any): SquidImplementationDetail {
  switch(json?.isTypeOf) {
    case 'NativeToken': return new NativeToken(undefined, json)
    case 'OrmlToken': return new OrmlToken(undefined, json)
    case 'LiquidCrowdloanToken': return new LiquidCrowdloanToken(undefined, json)
    case 'LiquidityProviderToken': return new LiquidityProviderToken(undefined, json)
    case 'XcToken': return new XcToken(undefined, json)
    case 'Erc20Token': return new Erc20Token(undefined, json)
    default: throw new TypeError('Unknown json object passed as SquidImplementationDetail')
  }
}
