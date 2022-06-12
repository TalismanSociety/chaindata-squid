import { WsProvider } from '@polkadot/api'
import { Store } from '@subsquid/substrate-processor'

import { Chain, MaxGasPriorityFees } from './model'

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

export function setUnhealthy(chain: Chain): Chain {
  chain.isHealthy = false
  chain.rpcs.forEach((rpc) => (rpc.isHealthy = false))
  return chain
}

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

export function updateDeprecatedFields(chains: Chain[]): Chain[] {
  return [...chains].map((chain) => {
    if (chain.token !== chain.nativeToken?.token) chain.token = chain.nativeToken?.token
    if (chain.decimals !== chain.nativeToken?.decimals) chain.decimals = chain.nativeToken?.decimals
    if (chain.existentialDeposit !== chain.nativeToken?.existentialDeposit)
      chain.existentialDeposit = chain.nativeToken?.existentialDeposit
    if (chain.coingeckoId !== chain.nativeToken?.coingeckoId) chain.coingeckoId = chain.nativeToken?.coingeckoId
    if (chain.rates !== chain.nativeToken?.rates) chain.rates = chain.nativeToken?.rates

    return chain
  })
}

export const defaultMaxGasPriorityFees = ({
  low,
  medium,
  high,
}: { low?: string; medium?: string; high?: string } = {}) =>
  new MaxGasPriorityFees({
    low: typeof low === 'string' ? low : '2000000000', // 2_000_000_000 wei == 2 gwei
    medium: typeof medium === 'string' ? medium : '10000000000', // 10_000_000_000 wei == 10 gwei
    high: typeof high === 'string' ? high : '50000000000', // 50_000_000_000 wei == 50 gwei
  })

export function tokenSymbolWorkarounds(
  chainId: string
): { symbols: string[]; decimals: number[]; indexes: Array<{ name: string; index: number }> } | undefined {
  return {
    mangata: { symbols: ['MGX'], decimals: [18], indexes: [{ name: 'MGX', index: 0 }] },
    // 'gm-rococo': [{ name: 'TODO', index: TODO }, { name: 'TODO', index: TODO }],
  }[chainId]
}
