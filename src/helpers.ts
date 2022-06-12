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
    loadRelationIds: { disableMixedMap: true },
  })

  if (entity == null) {
    entity = new entityConstructor()
    entity.id = id
  }

  return entity
}

export async function getOrCreateToken<T extends { id: string; isTestnet: boolean; isTypeOf: string }>(
  store: Store,
  tokenConstructor: { new (...args: any[]): T },
  id: string
): Promise<T> {
  const tokenEntity = await getOrCreate(store, Token, id)

  if (!(tokenEntity.squidImplementationDetail instanceof tokenConstructor)) {
    const newToken = new tokenConstructor()
    newToken.id = id
    newToken.isTestnet = false
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
      'chain' in token && typeof token.chain === 'string' ? await getOrCreate(store, Chain, token.chain) : null
    tokenEntity.squidImplementationDetailEvmNetwork =
      'evmNetwork' in token && typeof token.evmNetwork === 'string'
        ? await getOrCreate(store, EvmNetwork, token.evmNetwork)
        : null
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

export function sortChainsAndNetworks(chains: Chain[], evmNetworks: EvmNetwork[]): Array<Chain | EvmNetwork> {
  return [
    ...chains.map((chain): { entity: Chain; isChain: true } => ({
      entity: chain,
      isChain: true,
    })),
    ...evmNetworks.map((evmNetwork): { entity: EvmNetwork; isChain: false } => ({
      entity: evmNetwork,
      isChain: false,
    })),
  ]
    .sort((_a, _b) => {
      const a = _a.entity
      const b = _b.entity

      if (a.id === b.id) return 0
      if (a.id === 'polkadot') return -1
      if (b.id === 'polkadot') return 1
      if (a.id === 'kusama') return -1
      if (b.id === 'kusama') return 1
      if (a.isTestnet !== b.isTestnet) {
        if (a.isTestnet) return 1
        if (b.isTestnet) return -1
      }

      const aCmp = _a.isChain ? a.id : a.name?.toLowerCase() || parseInt(a.id)
      const bCmp = _b.isChain ? b.id : b.name?.toLowerCase() || parseInt(b.id)

      if (typeof aCmp === 'number' && typeof bCmp === 'number') return aCmp - bCmp
      if (typeof aCmp === 'number') return 1
      if (typeof bCmp === 'number') return -1

      return aCmp.localeCompare(bCmp)
    })
    .map((chainOrNetwork, index) => {
      if (chainOrNetwork.entity.sortIndex !== index + 1) chainOrNetwork.entity.sortIndex = index + 1
      return chainOrNetwork.entity
    })
}

export function tokenSymbolWorkarounds(
  chainId: string
): { symbols: string[]; decimals: number[]; indexes: Array<{ name: string; index: number }> } | undefined {
  return {
    mangata: { symbols: ['MGX'], decimals: [18], indexes: [{ name: 'MGX', index: 0 }] },
    // 'gm-rococo': [{ name: 'TODO', index: TODO }, { name: 'TODO', index: TODO }],
  }[chainId]
}
