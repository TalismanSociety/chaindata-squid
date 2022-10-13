import { BlockHandlerContext } from '@subsquid/substrate-processor'
import { ChainConnectorEvm } from '@talismn/chain-connector-evm'
import { EvmNetwork as ChaindataEvmNetwork, ChaindataProvider } from '@talismn/chaindata-provider'
import axios from 'axios'
import { EntityManager } from 'typeorm'

import { getOrCreate } from '../helpers'
import { BalanceModuleConfig, BalanceModuleMetadata, Chain, EthereumRpc, EvmNetwork, Token } from '../model'
import { GithubEvmNetwork } from '../types'
import { balanceModules, githubEvmNetworkLogoUrl } from './_constants'
import { processorSharedData } from './_sharedData'

export async function updateEvmNetworksFromGithub({ store }: BlockHandlerContext<EntityManager>) {
  const isStandaloneEvmNetwork = (evmNetwork: EvmNetwork | GithubEvmNetwork) =>
    evmNetwork instanceof EvmNetwork
      ? typeof evmNetwork.substrateChain?.id !== 'string'
      : typeof evmNetwork.substrateChainId === 'undefined' && typeof evmNetwork.name !== 'undefined'

  const isSubstrateEvmNetwork = (evmNetwork: EvmNetwork | GithubEvmNetwork) =>
    evmNetwork instanceof EvmNetwork
      ? typeof evmNetwork.substrateChain?.id === 'string'
      : typeof evmNetwork.substrateChainId !== 'undefined'

  const isInvalidEvmNetwork = (evmNetwork: EvmNetwork | GithubEvmNetwork) =>
    !isStandaloneEvmNetwork(evmNetwork) && !isSubstrateEvmNetwork(evmNetwork)

  const storeEvmNetworks = await store.find(EvmNetwork, { loadRelationIds: { disableMixedMap: true } })
  const deletedStandaloneEvmNetworkIdsMap = Object.fromEntries(
    storeEvmNetworks.filter(isStandaloneEvmNetwork).map(({ id }) => [id, true])
  )
  const deletedSubstrateEvmNetworkIdsMap = Object.fromEntries(
    storeEvmNetworks.filter(isSubstrateEvmNetwork).map(({ id }) => [id, true])
  )
  const deletedInvalidEvmNetworkIds = storeEvmNetworks.filter(isInvalidEvmNetwork).map(({ id }) => id)

  const githubEvmNetworks = processorSharedData.githubEvmNetworks
  const standaloneEvmNetworks = await Promise.all(
    githubEvmNetworks.filter(isStandaloneEvmNetwork).map(async (evmNetwork) => {
      let entity = await store.findOne(EvmNetwork, {
        where: { name: evmNetwork.name },
        loadRelationIds: { disableMixedMap: true },
      })
      if (!entity) {
        entity = new EvmNetwork()
      }

      entity.isTestnet = evmNetwork.isTestnet || false
      entity.name = evmNetwork.name
      entity.logo = githubEvmNetworkLogoUrl(entity.id)
      entity.explorerUrl = evmNetwork.explorerUrl
      entity.rpcs = (evmNetwork.rpcs || []).map((url) => new EthereumRpc({ url, isHealthy: false }))
      if (!entity.balanceMetadata) entity.balanceMetadata = []
      entity.balanceModuleConfigs = Object.entries(evmNetwork.balanceModuleConfigs || {}).map(
        ([moduleType, moduleConfig]) => new BalanceModuleConfig({ moduleType, moduleConfig })
      )

      entity.substrateChain = null

      return entity
    })
  )
  const substrateEvmNetworks = (
    await Promise.all(
      githubEvmNetworks.filter(isSubstrateEvmNetwork).map(async (evmNetwork) => {
        let entity = await store.findOne(EvmNetwork, {
          where: { substrateChain: { id: evmNetwork.substrateChainId } },
          loadRelationIds: { disableMixedMap: true },
        })
        if (!entity) {
          entity = new EvmNetwork()
        }

        entity.isTestnet = evmNetwork.isTestnet || false
        entity.name = evmNetwork.name
        entity.logo = githubEvmNetworkLogoUrl(entity.id)
        entity.explorerUrl = evmNetwork.explorerUrl
        entity.rpcs = (evmNetwork.rpcs || []).map((url) => new EthereumRpc({ url, isHealthy: false }))
        if (!entity.balanceMetadata) entity.balanceMetadata = []
        entity.balanceModuleConfigs = Object.entries(evmNetwork.balanceModuleConfigs || {}).map(
          ([moduleType, moduleConfig]) => new BalanceModuleConfig({ moduleType, moduleConfig })
        )

        const substrateChain = await store.findOne(Chain, {
          where: { id: evmNetwork.substrateChainId },
          loadRelationIds: { disableMixedMap: true },
        })
        if (!substrateChain) return null
        entity.substrateChain = substrateChain
        entity.isTestnet = substrateChain.isTestnet
        entity.name = evmNetwork.name || substrateChain.name
        entity.logo = substrateChain.logo
        // entity.nativeToken = substrateChain.nativeToken

        return entity
      })
    )
  ).filter(<T>(evmNetwork: T): evmNetwork is NonNullable<T> => !!evmNetwork)

  let allEvmNetworks = [...standaloneEvmNetworks, ...substrateEvmNetworks]

  // used for balanceMetadata + tokens fetching
  const chainConnectorEvm = new ChainConnectorEvm()

  // get network ids + rpc health statuses
  allEvmNetworks = (
    await Promise.all(
      allEvmNetworks.map(async (evmNetwork) => {
        const ethereumIds: Array<string | null> = await Promise.all(
          evmNetwork.rpcs.map(async (rpc) => {
            // try to connect to rpc
            try {
              const response = await axios.post(
                rpc.url,
                JSON.stringify({ method: 'eth_chainId', params: [], id: 1, jsonrpc: '2.0' }),
                {
                  headers: {
                    'Content-Type': 'application/json',
                    // our extension will send this header with every request
                    // some RPCs reject this header, in which case we want to set isHealthy to false
                    Origin: 'chrome-extension://abpofhpcakjhnpklgodncneklaobppdc',
                  },
                }
              )

              // check response status
              if (response.status !== 200)
                throw new Error(`Non-200 response status (${response.status}) from ethereum rpc`)

              const ethereumId = parseInt(response.data.result)
              if (Number.isNaN(ethereumId))
                throw new Error(`NaN response to eth_chainId: ${JSON.stringify(response.data)}`)

              // set healthy
              rpc.isHealthy = true
              return ethereumId.toString(10)
            } catch (error) {
              // set unhealthy
              rpc.isHealthy = false
              return null
            }
          })
        )

        // set id
        if (ethereumIds.filter((id): id is string => id !== null).length > 0) {
          // set id to the first healthy rpc's ethereumId
          evmNetwork.id = ethereumIds.filter((id): id is string => id !== null)[0]

          // set any rpcs with a different ethereumId to unhealthy
          ethereumIds.forEach((id, rpcIndex) => {
            if (id === evmNetwork.id) return
            ;(evmNetwork.rpcs[rpcIndex] || {}).isHealthy = false
          })
        }

        // set evmNetwork unhealthy if there are no healthy rpcs
        const healthyRpcUrls = evmNetwork.rpcs.filter(({ isHealthy }) => isHealthy).map(({ url }) => url)
        evmNetwork.isHealthy = healthyRpcUrls.length > 0

        if (typeof evmNetwork.id !== 'string') return null

        // if standalone, update the logo (which is based on the id)
        if (isStandaloneEvmNetwork(evmNetwork)) evmNetwork.logo = githubEvmNetworkLogoUrl(evmNetwork.id)

        isStandaloneEvmNetwork(evmNetwork) && delete deletedStandaloneEvmNetworkIdsMap[evmNetwork.id]
        isSubstrateEvmNetwork(evmNetwork) && delete deletedSubstrateEvmNetworkIdsMap[evmNetwork.id]

        // TODO: Remove this stubChaindataProvider hack
        const stubChaindataProvider: ChaindataProvider = {
          chainIds: () => Promise.resolve([]),
          chains: () => Promise.resolve({}),
          getChain: () => Promise.resolve(null),

          evmNetworkIds: () => Promise.resolve([evmNetwork.id]),
          evmNetworks: () => Promise.resolve({ [evmNetwork.id]: evmNetwork as any as ChaindataEvmNetwork }),
          getEvmNetwork: (evmNetworkId) =>
            Promise.resolve(evmNetworkId === evmNetwork.id ? (evmNetwork as any as ChaindataEvmNetwork) : null),

          tokenIds: () => Promise.resolve([]),
          tokens: () => Promise.resolve({}),
          getToken: () => Promise.resolve(null),
        }

        // fetch balance metadata for evm networks
        evmNetwork.balanceMetadata = (
          await Promise.all(
            balanceModules.map(async (balanceModule) => [
              balanceModule.type,
              await balanceModule.fetchEvmChainMeta(chainConnectorEvm, stubChaindataProvider, evmNetwork.id),
            ])
          )
        )
          .filter(([moduleType, metadata]) => typeof moduleType === 'string' && metadata)
          .map(([moduleType, metadata]) => new BalanceModuleMetadata({ moduleType, metadata }))

        return evmNetwork
      })
    )
  ).filter(<T>(evmNetwork: T): evmNetwork is NonNullable<T> => !!evmNetwork)

  await store.save(allEvmNetworks)

  const deletedEvmNetworkIds = [
    ...deletedInvalidEvmNetworkIds,
    ...Object.keys(deletedStandaloneEvmNetworkIdsMap),
    ...Object.keys(deletedSubstrateEvmNetworkIdsMap),
  ]
  if (deletedEvmNetworkIds.length > 0) await store.delete(EvmNetwork, deletedEvmNetworkIds)

  // update evm network tokens
  await Promise.all(
    allEvmNetworks.map(async (evmNetwork) => {
      // TODO: Remove this stubChaindataProvider hack
      const stubChaindataProvider: ChaindataProvider = {
        chainIds: () => Promise.resolve([]),
        chains: () => Promise.resolve({}),
        getChain: () => Promise.resolve(null),

        evmNetworkIds: () => Promise.resolve([evmNetwork.id]),
        evmNetworks: () => Promise.resolve({ [evmNetwork.id]: evmNetwork as any as ChaindataEvmNetwork }),
        getEvmNetwork: (evmNetworkId) =>
          Promise.resolve(evmNetworkId === evmNetwork.id ? (evmNetwork as any as ChaindataEvmNetwork) : null),

        tokenIds: () => Promise.resolve([]),
        tokens: () => Promise.resolve({}),
        getToken: () => Promise.resolve(null),
      }

      const tokens = (
        await Promise.all(
          balanceModules
            .filter((balanceModule) =>
              evmNetwork.balanceMetadata.find((meta) => meta.moduleType === balanceModule.type)
            )
            .map(
              async (balanceModule) =>
                await balanceModule.fetchEvmChainTokens(
                  chainConnectorEvm,
                  stubChaindataProvider,
                  evmNetwork.id,
                  evmNetwork.balanceMetadata.find((meta) => meta.moduleType === balanceModule.type)?.metadata,
                  evmNetwork.balanceModuleConfigs.find(({ moduleType }) => moduleType === balanceModule.type)
                    ?.moduleConfig
                )
            )
        )
      ).flatMap((moduleTokens) => Object.values(moduleTokens))

      const existingTokens = await store.find(Token, {
        where: { squidImplementationDetailEvmNetwork: { id: evmNetwork.id } },
        loadRelationIds: { disableMixedMap: true },
      })
      const deletedTokensMap = Object.fromEntries(existingTokens.map((token) => [token.id, token]))
      for (const token of tokens) {
        const tokenEntity = await getOrCreate(store, Token, (token as any)?.id)
        delete deletedTokensMap[(token as any)?.id]

        tokenEntity.data = token
        tokenEntity.squidImplementationDetailChain = (token as any)?.chain?.id ? (token as any)?.chain : null
        tokenEntity.squidImplementationDetailEvmNetwork = (token as any)?.evmNetwork?.id
          ? (token as any)?.evmNetwork
          : null

        await store.save(tokenEntity)

        if ((token as any)?.type === 'evm-native') {
          await store.update(EvmNetwork, { id: evmNetwork.id }, { nativeToken: { id: tokenEntity.id } })
        }
      }
      for (const deletedToken of Object.values(deletedTokensMap)) {
        await store.remove(deletedToken)
      }
    })
  )
}
