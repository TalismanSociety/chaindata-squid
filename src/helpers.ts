import { WsProvider } from '@polkadot/api'
import { Store } from '@subsquid/substrate-processor'

import {
  Chain,
  Erc20Token,
  EvmNetwork,
  LiquidCrowdloanToken,
  LiquidityProviderToken,
  NativeToken,
  OrmlToken,
  SquidImplementationDetail,
  Token,
  XcToken,
} from './model'

export async function getOrCreate<T extends { id: string }>(
  store: Store,
  entityConstructor: { new (...args: any[]): T },
  id: string
): Promise<T> {
  let entity = await store.get<T>(entityConstructor, {
    where: { id },
  })

  if (entity == null) {
    entity = new entityConstructor()
    entity.id = id
  }

  return entity
}

export async function getOrCreateToken<T extends { id: string; isTypeOf: string }>(
  store: Store,
  tokenConstructor: { new (...args: any[]): T },
  id: string
): Promise<T> {
  const tokenEntity = await getOrCreate(store, Token, id)
  const newToken = new tokenConstructor()

  if (!(tokenEntity.squidImplementationDetail instanceof tokenConstructor)) {
    newToken.id = id
    return newToken
  }

  return tokenEntity.squidImplementationDetail
}

export async function saveToken(store: Store, token: SquidImplementationDetail) {
  const tokenEntity = await getOrCreate(store, Token, token.id)

  if (token.isTypeOf === 'NativeToken') {
    // update implementation detail reverse lookups
    tokenEntity.squidImplementationDetailChain = null
    tokenEntity.squidImplementationDetailEvmNetwork = null

    // TODO: Run this every time a chain's nativeToken reference is changed.
    // Otherwise we'll store a stale reference here until this token is later modified again.
    //
    // WORKING: Update chains, then update tokens.
    // STALE REFERENCES/HERE BE DRAGONS: Update tokens, then set chain nativeTokens.

    // TODO: Add support for forward lookups once https://github.com/subsquid/squid/issues/41 is merged
    // // update implementation detail forward lookups
    // token.chain = tokenEntity.squidImplementationDetailNativeToChains
    //   ? tokenEntity.squidImplementationDetailNativeToChains[0]?.id
    //   : undefined
    // token.evmNetwork = tokenEntity.squidImplementationDetailNativeToEvmNetworks
    //   ? tokenEntity.squidImplementationDetailNativeToEvmNetworks[0]?.id
    //   : undefined
  } else {
    // update implementation detail reverse lookups
    tokenEntity.squidImplementationDetailChain =
      'chain' in token && token.chain ? await getOrCreate(store, Chain, token.chain) : null
    tokenEntity.squidImplementationDetailEvmNetwork =
      'evmNetwork' in token && token.evmNetwork ? await getOrCreate(store, EvmNetwork, token.evmNetwork) : null
  }

  tokenEntity.squidImplementationDetail = token
  await store.save(tokenEntity)
}

export const nativeTokenId = (chainId: Chain['id'], tokenSymbol: NativeToken['symbol']) =>
  `${chainId}-native-${tokenSymbol}`.toLowerCase()
export const ormlTokenId = (chainId: Chain['id'], tokenSymbol: OrmlToken['symbol']) =>
  `${chainId}-orml-${tokenSymbol}`.toLowerCase()
export const liquidCrowdloanTokenId = (chainId: Chain['id'], tokenSymbol: LiquidCrowdloanToken['symbol']) =>
  `${chainId}-lc-${tokenSymbol}`.toLowerCase()
export const liquidityProviderTokenId = (chainId: Chain['id'], tokenSymbol: LiquidityProviderToken['symbol']) =>
  `${chainId}-lp-${tokenSymbol}`.toLowerCase()
export const xcTokenId = (chainId: Chain['id'], tokenSymbol: XcToken['symbol']) =>
  `${chainId}-xc-${tokenSymbol}`.toLowerCase()
export const erc20TokenId = (evmNetworkId: EvmNetwork['id'], tokenContractAddress: Erc20Token['contractAddress']) =>
  `${evmNetworkId}-erc20-${tokenContractAddress}`.toLowerCase()

export function sendWithTimeout(socket: WsProvider, requests: Array<[string, any?]>, timeout: number): Promise<any[]> {
  return new Promise(async (_resolve, _reject) => {
    let done = false
    const resolve = (value: any[]) => {
      done = true
      _resolve(value)
    }
    const reject = (reason?: any) => {
      done = true
      _reject(reason)
    }

    if (socket === null) return reject('no socket')
    socket.on('error', () => reject('socket error'))

    setTimeout(() => !done && reject('timeout'), timeout)

    await socket.connect()
    await socket.isReady

    const results = await Promise.all(requests.map(([method, params = []]) => socket.send(method, params)))

    resolve(results)
  })
}

export function sortChains(chains: Chain[]): Chain[] {
  return [...chains]
    .sort((a, b) => {
      if (a.id === b.id) return 0
      if (a.id === 'polkadot') return -1
      if (b.id === 'polkadot') return 1
      if (a.id === 'kusama') return -1
      if (b.id === 'kusama') return 1
      if (a.isTestnet !== b.isTestnet) {
        if (a.isTestnet) return 1
        if (b.isTestnet) return -1
      }
      return a.id.localeCompare(b.id)
    })
    .map((chain, sortIndex) => {
      if (chain.sortIndex !== sortIndex) chain.sortIndex = sortIndex
      return chain
    })
}
