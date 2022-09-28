import { WsProvider } from '@polkadot/api'
import { ProviderInterfaceCallback } from '@polkadot/rpc-provider/types'
import { Metadata, TypeRegistry } from '@polkadot/types'
import { BlockHandlerContext } from '@subsquid/substrate-processor'
import { ChainConnector } from '@talismn/chain-connector'
import { ChainId, Chain as ChaindataChain, ChaindataProvider } from '@talismn/chaindata-provider'
import pMap from 'p-map'
import { EntityManager } from 'typeorm'

import { getOrCreate, sendWithTimeout } from '../helpers'
import { BalanceModuleMetadata, Chain, SubstrateRpc, Token } from '../model'
import { balanceModules, chainRpcTimeout, processSubstrateChainsConcurrency as concurrency } from './_constants'

export async function fetchDataForChains(ctx: BlockHandlerContext<EntityManager>) {
  const { store } = ctx

  const chains = await store.find(Chain, { loadRelationIds: { disableMixedMap: true } })
  const fetchDataForChain = createDataFetcher(chains.length)(ctx)

  // pMap lets us run `fetchDataForChain` on all of the chains in parallel,
  // but with a max limit on how many chains we are fetching data for at the same time
  await pMap(chains, fetchDataForChain, { concurrency })
}

const createDataFetcher =
  (numChains: number) =>
  (ctx: BlockHandlerContext<EntityManager>) =>
  async (chain: Chain, index: number): Promise<void> => {
    const { log } = ctx

    log.info(`Updating chain ${index + 1} of ${numChains} (${chain.id})`)

    // update health status of rpcs
    await updateChainRpcHealthStatuses(ctx, chain)

    // update health status of chain
    // depends on chain rpc health statuses, so update them first!
    await updateChainHealthStatus(ctx, chain)

    // fetch data for chain
    // makes use of the chain rpcs (filtered by health status), so update them first!
    await updateDataForChain(ctx, chain)
  }

const updateChainRpcHealthStatuses = async (ctx: BlockHandlerContext<EntityManager>, chain: Chain) => {
  const { store } = ctx

  // to save time, rpcs are updated in parallel, not in sequence
  await Promise.all(chain.rpcs.map((rpc) => updateChainRpcHealthStatus(ctx, chain.id, rpc)))

  await store.save(chain)
}

const updateChainRpcHealthStatus = async (
  ctx: BlockHandlerContext<EntityManager>,
  chainId: ChainId,
  rpc: SubstrateRpc
) => {
  const { log } = ctx

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // try to connect to rpc
    let socket: WsProvider | null = null
    try {
      const autoConnectMs = 500
      socket = new WsProvider(
        rpc.url,
        autoConnectMs,
        {
          // our extension will send this header with every request
          // some RPCs reject this header, in which case we want to set isHealthy to false
          Origin: 'chrome-extension://abpofhpcakjhnpklgodncneklaobppdc',
        },
        // doesn't matter what this is as long as it's a bit larger than chainRpcTimeout
        // if it's not set then `new WsProvider` will throw an uncatchable error after 60s
        chainRpcTimeout * 99
      )

      // fetch genesis hash
      await sendWithTimeout(socket, [['chain_getBlockHash', [0]]], chainRpcTimeout)

      // set healthy
      rpc.isHealthy = true

      // don't need to try again
      break
    } catch (error) {
      // set unhealthy
      log.warn(`${chainId} rpc ${rpc.url} is down on attempt ${attempt} ${JSON.stringify(error)}`)
      rpc.isHealthy = false
    } finally {
      try {
        socket !== null && (await socket.disconnect())
        socket = null
      } catch (error) {
        log.error(`Disconnect error ${JSON.stringify(error)}`)
      }
    }
  }
}

const updateChainHealthStatus = async (ctx: BlockHandlerContext<EntityManager>, chain: Chain) => {
  const { store } = ctx

  // if any rpcs are healthy: chain is also healthy
  // if no rpcs are healthy: chain is unhealthy
  chain.isHealthy = chain.rpcs.filter(({ isHealthy }) => isHealthy).length > 0

  await store.save(chain)
}

const updateDataForChain = async (ctx: BlockHandlerContext<EntityManager>, chain: Chain) => {
  const { store, log } = ctx

  const rpcs = chain.rpcs.filter(({ isHealthy }) => isHealthy).map(({ url }) => url)
  const maxAttempts = rpcs.length * 2 // attempt each rpc twice, at most

  let success = false
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    success = await attemptToUpdateDataForChain(ctx, chain, rpcs[(attempt - 1) % rpcs.length], attempt)

    // if chain has been successfully updated, exit the loop here
    if (success) break
  }

  if (!success) {
    // ran out of attempts
    log.warn(`${chain.id} all attempts (${maxAttempts}) failed`)
    chain.isHealthy = false
  }

  await store.save(chain)
}

const attemptToUpdateDataForChain = async (
  ctx: BlockHandlerContext<EntityManager>,
  chain: Chain,
  rpcUrl: string,
  attempt: number
): Promise<boolean> => {
  const { store, log } = ctx

  // try to connect to chain
  let socket: WsProvider | null = null
  try {
    const autoConnectMs = 500
    socket = new WsProvider(
      rpcUrl,
      autoConnectMs,
      {
        // our extension will send this header with every request
        // some RPCs reject this header, in which case we want to set isHealthy to false
        Origin: 'chrome-extension://abpofhpcakjhnpklgodncneklaobppdc',
      },
      // doesn't matter what this is as long as it's a bit larger than chainRpcTimeout
      // if it's not set then `new WsProvider` will throw an uncatchable error after 60s
      chainRpcTimeout * 99
    )

    // fetch rpc data
    const [genesisHash, runtimeVersion, metadataRpc, chainName, chainProperties] = await sendWithTimeout(
      socket,
      [
        ['chain_getBlockHash', [0]],
        ['state_getRuntimeVersion', []],
        ['state_getMetadata', []],
        ['system_chain', []],
        ['system_properties', []],
      ],
      chainRpcTimeout
    )

    // deconstruct rpc data
    const { specName, specVersion, implName } = runtimeVersion
    const { ss58Format } = chainProperties

    const metadata: Metadata = new Metadata(new TypeRegistry(), metadataRpc)
    metadata.registry.setMetadata(metadata)

    const ss58Prefix = metadata.registry.chainSS58

    // update tokens for this chain
    await updateChainTokens(ctx, socket, chain)

    // re-load chain with new token relations so we don't set them back to null again
    chain = await getOrCreate(store, Chain, chain.id)

    // set values
    chain.genesisHash = genesisHash
    chain.prefix = typeof ss58Prefix === 'number' ? ss58Prefix : typeof ss58Format === 'number' ? ss58Format : 42
    chain.chainName = chainName
    chain.implName = implName
    chain.specName = specName
    chain.specVersion = specVersion
    // chain.nativeToken = await getOrCreate(store, Token, nativeToken.id)

    // chain was successfully updated!
    return true
  } catch (error) {
    log.warn(`${chain.id} attempt ${attempt} failed ${JSON.stringify(error)}`)
  } finally {
    // attempt to disconnect socket, but ignore it if it has already been disconnected
    try {
      socket !== null && (await socket.disconnect())
      socket = null
    } catch (error) {
      log.error(`Disconnect error ${JSON.stringify(error)}`)
    }
  }

  // update was unsuccessful
  return false
}

async function updateChainTokens(ctx: BlockHandlerContext<EntityManager>, socket: WsProvider, chain: Chain) {
  const { store } = ctx

  // TODO: Remove this stubChainConnector & stubChaindataProvider hack
  const stubChainConnector = {
    async send<T = any>(
      chainId: ChainId,
      method: string,
      params: unknown[],
      isCacheable?: boolean | undefined
    ): Promise<T> {
      if (chainId !== chain.id) throw new Error(`Chain ${chainId} not supported by stub connector`)
      if (!socket) throw new Error(`Socket for chain ${chainId} unavailable`)

      return await socket.send(method, params, isCacheable)
    },

    async subscribe(
      chainId: ChainId,
      subscribeMethod: string,
      unsubscribeMethod: string,
      responseMethod: string,
      params: unknown[],
      callback: ProviderInterfaceCallback
    ): Promise<() => Promise<void>> {
      if (chainId !== chain.id) throw new Error(`Chain ${chainId} not supported by stub connector`)
      if (!socket) throw new Error(`Socket for chain ${chainId} unavailable`)

      const subscriptionId = await socket.subscribe(responseMethod, subscribeMethod, params, callback)

      const unsubscribe = async () => {
        socket && (await socket.unsubscribe(responseMethod, unsubscribeMethod, subscriptionId))
      }
      return unsubscribe
    },
  }
  const stubChaindataProvider: ChaindataProvider = {
    chainIds: () => Promise.resolve([chain.id]),
    chains: () => Promise.resolve({ [chain.id]: chain as unknown as ChaindataChain }),
    getChain: (chainId) => Promise.resolve(chainId === chain.id ? (chain as unknown as ChaindataChain) : null),

    evmNetworkIds: () => Promise.resolve([]),
    evmNetworks: () => Promise.resolve({}),
    getEvmNetwork: () => Promise.resolve(null),

    tokenIds: () => Promise.resolve([]),
    tokens: () => Promise.resolve({}),
    getToken: () => Promise.resolve(null),
  }

  chain.balanceMetadata = (
    await Promise.all(
      balanceModules.map(async (balanceModule) => [
        balanceModule.type,
        await balanceModule.fetchSubstrateChainMeta(
          stubChainConnector as ChainConnector,
          stubChaindataProvider,
          chain.id
        ),
      ])
    )
  )
    .filter(([moduleType, metadata]) => typeof moduleType === 'string' && metadata)
    .map(([moduleType, metadata]) => new BalanceModuleMetadata({ moduleType, metadata }))

  const tokens = (
    await Promise.all(
      balanceModules
        .filter((balanceModule) => chain.balanceMetadata.find((meta) => meta.moduleType === balanceModule.type))
        .map(
          async (balanceModule) =>
            await balanceModule.fetchSubstrateChainTokens(
              stubChainConnector as ChainConnector,
              stubChaindataProvider,
              chain.id,
              chain.balanceMetadata.find((meta) => meta.moduleType === balanceModule.type)?.metadata,
              chain.balanceModuleConfigs.find(({ moduleType }) => moduleType === balanceModule.type)?.moduleConfig
            )
        )
    )
  ).flatMap((moduleTokens) => Object.values(moduleTokens))

  const existingTokens = await store.find(Token, {
    where: { squidImplementationDetailChain: { id: chain.id } },
    loadRelationIds: { disableMixedMap: true },
  })
  const deletedTokensMap = Object.fromEntries(existingTokens.map((token) => [token.id, token]))
  for (const token of tokens) {
    const tokenEntity = await getOrCreate(store, Token, (token as any)?.id)
    delete deletedTokensMap[(token as any)?.id]

    tokenEntity.data = token
    tokenEntity.squidImplementationDetailChain = (token as any)?.chain
    tokenEntity.squidImplementationDetailEvmNetwork = (token as any)?.evmNetwork

    await store.save(tokenEntity)
  }
  for (const deletedToken of Object.values(deletedTokensMap)) {
    await store.remove(deletedToken)
  }
}
