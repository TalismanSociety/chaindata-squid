import { BlockHandlerContext } from '@subsquid/substrate-processor'
import axios from 'axios'
import { EntityManager } from 'typeorm'

import { Chain, EthereumRpc, EvmNetwork } from '../model'
import { GithubEvmNetwork } from '../types'
import { githubEvmNetworkLogoUrl } from './_constants'
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

        const substrateChain = await store.findOne(Chain, {
          where: { id: evmNetwork.substrateChainId },
          loadRelationIds: { disableMixedMap: true },
        })
        if (!substrateChain) return null
        entity.substrateChain = substrateChain
        entity.isTestnet = substrateChain.isTestnet
        entity.name = evmNetwork.name || substrateChain.name
        entity.logo = substrateChain.logo
        entity.nativeToken = substrateChain.nativeToken

        return entity
      })
    )
  ).filter(<T>(evmNetwork: T): evmNetwork is NonNullable<T> => !!evmNetwork)

  // get network ids + rpc health statuses
  const evmNetworkUpdates = (
    await Promise.all(
      [...standaloneEvmNetworks, ...substrateEvmNetworks].map(async (evmNetwork) => {
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

        isStandaloneEvmNetwork(evmNetwork) && delete deletedStandaloneEvmNetworkIdsMap[evmNetwork.id]
        isSubstrateEvmNetwork(evmNetwork) && delete deletedSubstrateEvmNetworkIdsMap[evmNetwork.id]

        // // set up nativeToken for standalone networks
        // if (isStandaloneEvmNetwork(evmNetwork)) {
        //   const githubNetwork = githubEvmNetworks
        //     .filter(isStandaloneEvmNetwork)
        //     .find((network) => network.name === evmNetwork.name)
        //   const nativeToken = await getOrCreateToken(
        //     store,
        //     NativeToken,
        //     nativeTokenId(evmNetwork.id, githubNetwork?.symbol || 'ETH')
        //   )
        //   nativeToken.symbol = githubNetwork?.symbol || 'ETH'
        //   nativeToken.decimals = typeof githubNetwork?.decimals === 'number' ? githubNetwork.decimals : 18
        //   await saveToken(store, nativeToken)
        //   evmNetwork.nativeToken = await getOrCreate(store, Token, nativeToken.id)
        // }

        // return evmNetwork
      })
    )
  ).filter(<T>(evmNetwork: T): evmNetwork is NonNullable<T> => !!evmNetwork)

  await store.save(evmNetworkUpdates)

  const deletedEvmNetworkIds = [
    ...deletedInvalidEvmNetworkIds,
    ...Object.keys(deletedStandaloneEvmNetworkIdsMap),
    ...Object.keys(deletedSubstrateEvmNetworkIdsMap),
  ]
  if (deletedEvmNetworkIds.length > 0) await store.delete(EvmNetwork, deletedEvmNetworkIds)
}
