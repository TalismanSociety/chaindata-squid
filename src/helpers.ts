import { WsProvider } from '@polkadot/api'
import { EntityManager, FindOptionsWhere } from 'typeorm'

import { Chain, EvmNetwork } from './model'

export async function getOrCreate<T extends { id: string }>(
  store: EntityManager,
  entityConstructor: { new (...args: any[]): T },
  id: string
): Promise<T> {
  let entity = await store.findOne<T>(entityConstructor, {
    where: { id } as FindOptionsWhere<T>,
    loadRelationIds: { disableMixedMap: true },
  })

  if (entity == null) {
    entity = new entityConstructor()
    entity.id = id
  }

  return entity
}

// export const liquidCrowdloanTokenId = (chainId: Chain['id'], tokenSymbol: LiquidCrowdloanToken['symbol']) =>
//   `${chainId}-lc-${tokenSymbol}`.toLowerCase()
// export const liquidityProviderTokenId = (chainId: Chain['id'], tokenSymbol: LiquidityProviderToken['symbol']) =>
//   `${chainId}-lp-${tokenSymbol}`.toLowerCase()
// export const xcTokenId = (chainId: Chain['id'], tokenSymbol: XcToken['symbol']) =>
//   `${chainId}-xc-${tokenSymbol}`.toLowerCase()

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

    try {
      if (socket === null) return reject('no socket')
      socket.on('error', () => reject('socket error'))
      socket.on('disconnected', () => reject('socket closed'))

      setTimeout(() => !done && reject('socket timeout reached'), timeout)

      await socket.isReady

      resolve(await Promise.all(requests.map(([method, params = []]) => socket.send(method, params))))
    } catch (error) {
      reject(error as any)
    }
  })
}

export function sortChainsAndNetworks(chains: Chain[], evmNetworks: EvmNetwork[]): Array<Chain | EvmNetwork> {
  return [...chains, ...evmNetworks]
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
      if (a.id === 'westend-testnet') return -1
      if (b.id === 'westend-testnet') return 1
      if (a.id === 'rococo-testnet') return -1
      if (b.id === 'rococo-testnet') return 1

      const aCmp = a.name?.toLowerCase() || parseInt(a.id)
      const bCmp = b.name?.toLowerCase() || parseInt(b.id)

      if (typeof aCmp === 'number' && typeof bCmp === 'number') return aCmp - bCmp
      if (typeof aCmp === 'number') return 1
      if (typeof bCmp === 'number') return -1

      return aCmp.localeCompare(bCmp)
    })
    .map((chainOrNetwork, index) => {
      if (chainOrNetwork.sortIndex !== index + 1) chainOrNetwork.sortIndex = index + 1
      return chainOrNetwork
    })
}
