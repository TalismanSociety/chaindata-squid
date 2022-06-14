import { WsProvider } from '@polkadot/api'
import { Metadata } from '@polkadot/types'
import { hexToBn } from '@polkadot/util'
import { lookupArchive } from '@subsquid/archive-registry'
import { BlockHandlerContext, SubstrateProcessor } from '@subsquid/substrate-processor'
import { createMetadata, getRegistry } from '@substrate/txwrapper-polkadot'
import axios from 'axios'
import { startCase } from 'lodash'

import {
  erc20TokenId,
  getOrCreate,
  getOrCreateToken,
  nativeTokenId,
  ormlTokenId,
  saveToken,
  sendWithTimeout,
  sortChainsAndNetworks,
  tokenSymbolWorkarounds,
} from './helpers'
import {
  Chain,
  Erc20Token,
  EthereumRpc,
  EvmNetwork,
  NativeToken,
  OrmlToken,
  SubstrateRpc,
  Token,
  TokenRates,
} from './model'
import { GithubChain, GithubEvmNetwork, GithubToken, NonFunctionPropertyNames } from './types'

const processor = new SubstrateProcessor('chaindata')

const numBlocksPerExecution = 50 // only run every 50 blocks ≈ 5 minutes at 6s / block
const skipBlocksOlderThan = 86_400_000 // 86,400 seconds = skip execution for any blocks older than 24 hours
const githubChaindataBranch = 'feat/split-entities' // 'main'
const githubChaindataBaseUrl = `https://raw.githubusercontent.com/TalismanSociety/chaindata/${githubChaindataBranch}`
const githubChainsUrl = `${githubChaindataBaseUrl}/chaindata.json`
const githubTestnetChainsUrl = `${githubChaindataBaseUrl}/testnets-chaindata.json`
const githubEvmNetworksUrl = `${githubChaindataBaseUrl}/evm-networks.json`
const githubTokensUrl = `${githubChaindataBaseUrl}/tokens.json`
const coingeckoApiUrl = 'https://api.coingecko.com/api/v3'
const coingeckoCurrencies: Array<NonFunctionPropertyNames<TokenRates>> = [
  'usd',
  // 'aud',
  // 'nzd',
  // 'cud',
  // 'hkd',
  'eur',
  // 'gbp',
  // 'jpy',
  // 'krw',
  // 'cny',
  // 'btc',
  // 'eth',
  // 'dot',
]

// chain is set to unhealthy if no RPC responds before this timeout
const chainRpcTimeout = 120_000 // 120_000ms = 120 seconds = 2 minutes timeout on RPC requests

processor.setBatchSize(500)
processor.setBlockRange({ from: 10_710_000 })
processor.setDataSource({
  chain: 'wss://rpc.polkadot.io',
  archive: lookupArchive('polkadot')[0].url,
})

processor.addPostHook(async (context) => {
  const { block } = context

  const blockHeight = block.height
  const blockTimestamp = block.timestamp

  // only run every n blocks
  if (blockHeight % numBlocksPerExecution !== 0) return

  // skip blocks older than n
  if (Date.now() - blockTimestamp > skipBlocksOlderThan) return

  console.debug(`Executing on block ${blockHeight}: block is recent and a multiple of ${numBlocksPerExecution}`)

  for (const [index, executeStep] of processorSteps.entries()) {
    console.log(`Executing step ${index + 1}:`, startCase(executeStep.name))
    await executeStep(context)
  }
})

// indexer breaks if we don't subscribe to at least one type of event in addition to the postBlock hook
processor.addEventHandler('balances.Transfer', async () => {})

// run the processor on start
processor.run()

//
// processor steps
//

const processorSharedData: {
  githubChains: GithubChain[]
  githubEvmNetworks: GithubEvmNetwork[]
  githubTokens: GithubToken[]
} = { githubChains: [], githubEvmNetworks: [], githubTokens: [] }

const processorSteps: Array<(context: BlockHandlerContext) => Promise<void>> = [
  async function fetchDataFromGithub() {
    // fetch chains, evmNetworks and tokens from chaindata github repo
    const [githubChains, githubEvmNetworks, githubTokens] = await Promise.all([
      (
        await Promise.all([
          axios.get(githubChainsUrl).then((response) => response.data),
          axios
            .get(githubTestnetChainsUrl)
            .then((response) => response.data)
            .then((data) => data.map((chain: GithubChain) => ({ ...chain, isTestnet: true }))),
        ])
      ).flatMap((chains) => chains),
      axios.get(githubEvmNetworksUrl).then((response) => response.data),
      axios.get(githubTokensUrl).then((response) => response.data),
    ])

    processorSharedData.githubChains = githubChains
    processorSharedData.githubEvmNetworks = githubEvmNetworks
    processorSharedData.githubTokens = githubTokens
  },

  async function updateChainsFromGithub({ store }) {
    const deletedChainIdsMap = Object.fromEntries((await store.find(Chain)).map((chain) => [chain.id, true]))

    // add github chains to the db
    for (const githubChain of processorSharedData.githubChains) {
      // don't delete this chain
      delete deletedChainIdsMap[githubChain.id]

      const chain = await getOrCreate(store, Chain, githubChain.id)
      const relay = githubChain.relay?.id ? await getOrCreate(store, Chain, githubChain.relay.id) : null

      // set values
      chain.isTestnet = githubChain.isTestnet || false
      chain.name = githubChain.name
      chain.account = githubChain.account
      chain.subscanUrl = githubChain.subscanUrl
      chain.rpcs = (githubChain.rpcs || []).map((url) => new SubstrateRpc({ url, isHealthy: false }))

      // only set relay and paraId if both exist on githubChain
      // TODO: Figure out parachains automatically
      chain.paraId = relay !== null && githubChain.paraId ? githubChain.paraId : null
      chain.relay = relay !== null && githubChain.paraId ? relay : null

      // save
      await store.save(chain)
    }

    // delete chains from db if they're no longer in github chaindata
    const deletedChainIds = Object.keys(deletedChainIdsMap)
    if (deletedChainIds.length > 0) await store.delete(Chain, deletedChainIds)
  },

  async function updateChainData({ store }) {
    const chains = await store.find(Chain, { loadRelationIds: { disableMixedMap: true } })

    await Promise.all(
      chains.map(async (chain): Promise<void> => {
        // get health status of rpcs
        await Promise.all(
          chain.rpcs.map(async (rpc) => {
            // try to connect to rpc
            let socket: WsProvider | null = null
            try {
              const autoConnectMs = 0
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
            } catch (error) {
              // set unhealthy
              rpc.isHealthy = false
            } finally {
              try {
                socket !== null && socket.disconnect()
              } catch (error) {
                console.error('Disconnect error', error)
              }
            }
          })
        )

        // set chain unhealthy if there are no healthy rpcs
        const healthyRpcUrls = chain.rpcs.filter(({ isHealthy }) => isHealthy).map(({ url }) => url)
        chain.isHealthy = healthyRpcUrls.length > 0
        await store.save(chain)

        // fetch chaindata from healthy rpcs
        const maxAttempts = healthyRpcUrls.length * 2
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          // try to connect to chain
          let socket: WsProvider | null = null
          try {
            socket = new WsProvider(
              healthyRpcUrls[(attempt - 1) % healthyRpcUrls.length],
              0,
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
            const { ss58Format, tokenDecimals: chainTokenDecimals, tokenSymbol: chainTokenSymbol } = chainProperties
            const registry = getRegistry({
              specName,
              specVersion,
              metadataRpc,
              chainName,
            })
            const metadata: Metadata = createMetadata(registry, metadataRpc)

            const tokenSymbolWorkaroundCurrencyId = tokenSymbolWorkarounds(chain.id)?.currencyId
            const tokenSymbolWorkaroundSymbols = tokenSymbolWorkarounds(chain.id)?.symbols
            const tokenSymbolWorkaroundDecimals = tokenSymbolWorkarounds(chain.id)?.decimals
            const tokenSymbolWorkaroundIndexes = tokenSymbolWorkarounds(chain.id)?.indexes

            const currencyIdDef = (metadata.asLatest.lookup?.types || []).find(
              ({ type }) => type.path.slice(-1).toString() === 'CurrencyId' && type?.def?.isVariant
            )
            const currencyIdVariants = (currencyIdDef?.type?.def?.asVariant?.variants.toJSON() || []) as Array<{
              name: string
              index: number
            }>
            const currencyIdLookup = Object.fromEntries(currencyIdVariants.map(({ name, index }) => [name, index]))
            const tokensCurrencyIdIndex =
              tokenSymbolWorkaroundCurrencyId !== undefined
                ? tokenSymbolWorkaroundCurrencyId
                : currencyIdLookup['Token']

            const tokenSymbol = tokenSymbolWorkaroundSymbols || chainTokenSymbol
            const tokenDecimals = tokenSymbolWorkaroundDecimals || chainTokenDecimals

            const tokenSymbolDef = (metadata.asLatest.lookup?.types || []).find(
              ({ type }) => type.path.slice(-1).toString() === 'TokenSymbol'
            )
            const tokenSymbolVariants = tokenSymbolWorkaroundIndexes
              ? tokenSymbolWorkaroundIndexes
              : ((tokenSymbolDef?.type?.def?.asVariant?.variants.toJSON() || []) as Array<{
                  name: string
                  index: number
                }>)
            const tokenIndexLookup = Object.fromEntries(tokenSymbolVariants.map(({ name, index }) => [name, index]))

            const existingTokens = (
              await store.find(Token, {
                where: { squidImplementationDetailChain: chain.id },
                loadRelationIds: { disableMixedMap: true },
              })
            ).filter((token) => token.squidImplementationDetail.isTypeOf === 'OrmlToken')
            const deletedTokensMap = Object.fromEntries(existingTokens.map((token) => [token.id, token]))
            for (const [index, symbol] of (Array.isArray(tokenSymbol) ? tokenSymbol : []).entries()) {
              const tokenIndex = tokenIndexLookup[symbol]
              if (tokenIndex === undefined) continue

              const token = await getOrCreateToken(store, OrmlToken, ormlTokenId(chain.id, symbol))
              delete deletedTokensMap[token.id]

              token.symbol = symbol
              token.decimals = tokenDecimals[index]
              // token.existentialDeposit = null
              token.index = tokenIndex
              token.chain = chain.id

              await saveToken(store, token)
            }
            for (const deletedToken of Object.values(deletedTokensMap)) {
              await store.remove(deletedToken)
            }

            // re-load chain with new token relations so we don't set them back to null again
            chain = await getOrCreate(store, Chain, chain.id)

            const existentialDepositCodec = metadata.asLatest.pallets
              .find((pallet: any) => pallet.name.eq('Balances'))
              ?.constants.find((constant: any) => constant.name.eq('ExistentialDeposit'))?.value
            const existentialDeposit = existentialDepositCodec
              ? hexToBn(existentialDepositCodec.toHex(), {
                  isLe: true,
                  isNegative: false,
                }).toString()
              : null

            const nativeTokenSymbol = Array.isArray(tokenSymbol) ? tokenSymbol[0] : tokenSymbol
            const nativeToken = await getOrCreateToken(store, NativeToken, nativeTokenId(chain.id, nativeTokenSymbol))
            nativeToken.symbol = nativeTokenSymbol
            nativeToken.decimals = Array.isArray(tokenDecimals) ? tokenDecimals[0] : tokenDecimals
            nativeToken.existentialDeposit = existentialDeposit === null ? null : BigInt(existentialDeposit)
            await saveToken(store, nativeToken)

            // set values
            chain.genesisHash = genesisHash
            chain.prefix = typeof ss58Format === 'number' ? ss58Format : 42
            chain.chainName = chainName
            chain.implName = implName
            chain.specName = specName
            chain.specVersion = specVersion
            chain.nativeToken = await getOrCreate(store, Token, nativeToken.id)
            chain.tokensCurrencyIdIndex = tokensCurrencyIdIndex

            await store.save(chain)
            return
          } catch (error) {
            console.warn(chain.id, `attempt ${attempt} failed`, error)
          } finally {
            try {
              socket !== null && socket.disconnect()
            } catch (error) {
              console.error('Disconnect error', error)
            }
          }
        }

        // ran out of attempts
        console.warn(chain.id, `all attempts (${maxAttempts}) failed`)
        chain.isHealthy = false

        await store.save(chain)
      })
    )
  },

  async function updateEvmNetworksFromGithub({ store }) {
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
        let entity = await store.get(EvmNetwork, {
          where: { name: evmNetwork.name },
          loadRelationIds: { disableMixedMap: true },
        })
        if (!entity) {
          entity = new EvmNetwork()
        }

        entity.isTestnet = evmNetwork.isTestnet || false
        entity.name = evmNetwork.name
        entity.explorerUrl = evmNetwork.explorerUrl
        entity.rpcs = (evmNetwork.rpcs || []).map((url) => new EthereumRpc({ url, isHealthy: false }))
        entity.substrateChain = null

        return entity
      })
    )
    const substrateEvmNetworks = (
      await Promise.all(
        githubEvmNetworks.filter(isSubstrateEvmNetwork).map(async (evmNetwork) => {
          let entity = await store.get(EvmNetwork, {
            where: { substrateChain: evmNetwork.substrateChainId },
            loadRelationIds: { disableMixedMap: true },
          })
          if (!entity) {
            entity = new EvmNetwork()
          }

          entity.isTestnet = evmNetwork.isTestnet || false
          entity.name = evmNetwork.name
          entity.explorerUrl = evmNetwork.explorerUrl
          entity.rpcs = (evmNetwork.rpcs || []).map((url) => new EthereumRpc({ url, isHealthy: false }))

          const substrateChain = await store.get(Chain, {
            where: { id: evmNetwork.substrateChainId },
            loadRelationIds: { disableMixedMap: true },
          })
          if (!substrateChain) return null
          entity.substrateChain = substrateChain
          entity.isTestnet = substrateChain.isTestnet
          entity.name = evmNetwork.name || substrateChain.name
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

          // set up nativeToken for standalone networks
          if (isStandaloneEvmNetwork(evmNetwork)) {
            const githubNetwork = githubEvmNetworks
              .filter(isStandaloneEvmNetwork)
              .find((network) => network.name === evmNetwork.name)
            const nativeToken = await getOrCreateToken(
              store,
              NativeToken,
              nativeTokenId(evmNetwork.id, githubNetwork?.symbol || 'ETH')
            )
            nativeToken.symbol = githubNetwork?.symbol || 'ETH'
            nativeToken.decimals = typeof githubNetwork?.decimals === 'number' ? githubNetwork.decimals : 18
            await saveToken(store, nativeToken)
            evmNetwork.nativeToken = await getOrCreate(store, Token, nativeToken.id)
          }

          return evmNetwork
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
  },

  async function updateSortIndexes({ store }) {
    const chains = await store.find(Chain, { loadRelationIds: { disableMixedMap: true } })
    const evmNetworks = await store.find(EvmNetwork, { loadRelationIds: { disableMixedMap: true } })

    const sorted = sortChainsAndNetworks(chains, evmNetworks)

    await store.save(sorted)
  },

  async function updateTokensFromGithub({ store }) {
    const isRenameOrCoingeckoId = (token: GithubToken) =>
      typeof token.id !== 'undefined' &&
      (typeof token.coingeckoId !== 'undefined' || typeof token.symbol !== 'undefined')

    const isErc20 = (token: GithubToken) =>
      typeof token.contractAddress !== 'undefined' && typeof token.evmNetworkId !== 'undefined'

    const { githubTokens } = processorSharedData

    for (const renameOrCoingeckoId of githubTokens.filter(isRenameOrCoingeckoId)) {
      const tokenEntity = await store.get(Token, {
        where: { id: renameOrCoingeckoId.id },
        loadRelationIds: { disableMixedMap: true },
      })
      if (!tokenEntity) continue

      const token = tokenEntity.squidImplementationDetail
      if (renameOrCoingeckoId.symbol) token.symbol = renameOrCoingeckoId.symbol
      if (renameOrCoingeckoId.coingeckoId) token.coingeckoId = renameOrCoingeckoId.coingeckoId

      await saveToken(store, token)
    }

    const existingErc20Tokens = (await store.find(Token, { loadRelationIds: { disableMixedMap: true } })).filter(
      (token) => token.squidImplementationDetail.isTypeOf === 'Erc20Token'
    )
    const deletedTokensMap = Object.fromEntries(existingErc20Tokens.map((token) => [token.id, token]))

    for (const erc20 of githubTokens.filter(isErc20)) {
      const evmNetwork = await store.get(EvmNetwork, {
        where: { id: erc20.evmNetworkId },
        loadRelationIds: { disableMixedMap: true },
      })
      if (!evmNetwork) continue

      const token = await getOrCreateToken(store, Erc20Token, erc20TokenId(evmNetwork.id, erc20.contractAddress))
      delete deletedTokensMap[token.id]

      // TODO: Import erc20 abi and fetch `symbol` and `decimals` from the evm network rpc
      token.symbol = erc20.symbol
      token.decimals = erc20.decimals
      token.coingeckoId = erc20.coingeckoId
      token.contractAddress = erc20.contractAddress
      // TODO: Add support for erc20 tokens on substrate networks (e.g. acala)
      // token.chain =
      token.evmNetwork = evmNetwork.id

      await saveToken(store, token)
    }

    for (const deletedToken of Object.values(deletedTokensMap)) {
      await store.remove(deletedToken)
    }
  },

  async function updateTokensTestnetField({ store }) {
    const chainsMap = Object.fromEntries(
      (await store.find(Chain, { loadRelationIds: { disableMixedMap: true } })).map((chain) => [chain.id, chain])
    )
    const evmNetworksMap = Object.fromEntries(
      (await store.find(EvmNetwork, { loadRelationIds: { disableMixedMap: true } })).map((evmNetwork) => [
        evmNetwork.id,
        evmNetwork,
      ])
    )

    const isTestnetToken = (token: Token) =>
      [
        ...[token.squidImplementationDetailChain, ...token.squidImplementationDetailNativeToChains]
          .filter(Boolean)
          .map((chain) => chainsMap[chain!.id]),
        ...[token.squidImplementationDetailEvmNetwork, ...token.squidImplementationDetailNativeToEvmNetworks]
          .filter(Boolean)
          .map((evmNetwork) => evmNetworksMap[evmNetwork!.id]),
      ]
        .filter(Boolean)
        .map(({ isTestnet }) => isTestnet)
        .every((isTestnet) => isTestnet)

    const tokens = await store.find(Token, { loadRelationIds: { disableMixedMap: true } })

    const updatedTokens = tokens.map((token) => {
      token.squidImplementationDetail.isTestnet = isTestnetToken(token)
      return token
    })

    await store.save(updatedTokens)
  },

  async function updateTokenRates({ store }) {
    const tokens = await store.find(Token, { loadRelationIds: { disableMixedMap: true } })

    // get coingecko ids from coingecko via token symbols
    const coingeckoList: Array<{ id: string; symbol: string; name: string }> = await axios
      .get(`${coingeckoApiUrl}/coins/list`)
      .then((response) => response.data)

    const coingeckoIdIndex = Object.fromEntries(coingeckoList.reverse().map((coin) => [coin.id, coin]))
    const coingeckoSymbolIndex = Object.fromEntries(
      coingeckoList.reverse().map((coin) => [coin.symbol.toUpperCase(), coin])
    )

    // a few favourites
    coingeckoSymbolIndex.DOT = coingeckoIdIndex.polkadot
    coingeckoSymbolIndex.KSM = coingeckoIdIndex.kusama

    const fetchCoingeckoIds = tokens
      .map((token) => {
        if (token.squidImplementationDetail.isTestnet) return

        const lookupSymbol = token.squidImplementationDetail.symbol?.toUpperCase()
        if (lookupSymbol && token.squidImplementationDetail.coingeckoId === undefined)
          token.squidImplementationDetail.coingeckoId = coingeckoSymbolIndex[lookupSymbol]?.id

        return [token.squidImplementationDetail.coingeckoId]
      })
      .filter(Boolean)

    const fetchCoingeckoIdsSerialized = fetchCoingeckoIds.join(',')
    const coingeckoCurrenciesSerialized = coingeckoCurrencies.join(',')
    const coingeckoPrices: Record<string, Record<string, number>> = await axios
      .get(
        `${coingeckoApiUrl}/simple/price?ids=${fetchCoingeckoIdsSerialized}&vs_currencies=${coingeckoCurrenciesSerialized}`
      )
      .then((response) => response.data)

    const updatedTokens = tokens.map((token) => {
      token.squidImplementationDetail.rates = null
      if (token.squidImplementationDetail.isTestnet) return token
      if (!token.squidImplementationDetail.coingeckoId) return token

      const rates = coingeckoPrices[token.squidImplementationDetail.coingeckoId]
      if (!rates) return token

      token.squidImplementationDetail.rates = new TokenRates()
      for (const currency of coingeckoCurrencies) {
        token.squidImplementationDetail.rates[currency] = rates[currency]
      }

      return token
    })

    await store.save(updatedTokens)
  },
]
