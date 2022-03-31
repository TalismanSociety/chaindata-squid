import { Chain, Rates, Rpc, Token } from './model'
import { GithubChain, NonFunctionPropertyNames } from './types'
import { createMetadata, getRegistry } from '@substrate/txwrapper-polkadot'
import { getOrCreate, sendWithTimeout, setUnhealthy, sortChains, updateDeprecatedFields } from './helpers'

import { Metadata } from '@polkadot/types'
import { SubstrateProcessor } from '@subsquid/substrate-processor'
import { WsProvider } from '@polkadot/api'
import axios from 'axios'
import { hexToBn } from '@polkadot/util'

const processor = new SubstrateProcessor('chaindata')

const numBlocksPerExecution = 50 // only run every 50 blocks ≈ 5 minutes at 6s / block
const skipBlocksOlderThan = 300_000 // 300_000ms = 300 seconds = skip execution for any blocks older than 5 minutes
const githubChaindataUrl = 'https://raw.githubusercontent.com/TalismanSociety/chaindata/main/chaindata.json'
const githubTestnetsChaindataUrl =
  'https://raw.githubusercontent.com/TalismanSociety/chaindata/main/testnets-chaindata.json'
const coingeckoApiUrl = 'https://api.coingecko.com/api/v3'
const coingeckoCurrencies: Array<NonFunctionPropertyNames<Rates>> = [
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

processor.setTypesBundle('kusama')
processor.setBatchSize(500)
processor.setBlockRange({ from: 12_054_000 })

processor.setDataSource({
  archive: 'https://kusama.indexer.gc.subsquid.io/v4/graphql',
  chain: 'wss://kusama-rpc.polkadot.io',
})

processor.addPostHook(async ({ block, store }) => {
  const blockHeight = block.height
  const blockTimestamp = block.timestamp

  // only run every n blocks
  if (blockHeight % numBlocksPerExecution !== 0) return

  // skip blocks older than n
  if (Date.now() - blockTimestamp > skipBlocksOlderThan) return

  console.debug(`executing on block ${blockHeight}: block is recent and a multiple of ${numBlocksPerExecution}`)

  //
  //
  // GITHUB -> DB
  //
  //

  // fetch chains from chaindata github repo
  const githubChains: GithubChain[] = (
    await Promise.all([
      axios.get(githubChaindataUrl).then((response) => response.data),
      axios
        .get(githubTestnetsChaindataUrl)
        .then((response) => response.data)
        .then((data) => data.map((chain: GithubChain) => ({ ...chain, isTestnet: true }))),
    ])
  ).flatMap((chains) => chains)

  const deleteChainIds = Object.fromEntries((await store.find(Chain)).map((chain) => [chain.id, true]))

  // add github chains to the db
  for (const githubChain of githubChains) {
    // don't delete this chain
    delete deleteChainIds[githubChain.id]

    const chain = await getOrCreate(store, Chain, githubChain.id)
    const relay = githubChain.relay?.id ? await getOrCreate(store, Chain, githubChain.relay.id) : null

    // only use githubChain value if db doesn't already have a value for this chain
    // values fetched via RPC will therefore take precedence
    if (!chain.prefix) chain.prefix = githubChain.prefix
    if (!chain.nativeToken) chain.nativeToken = new Token()
    if (!chain.nativeToken.token) chain.nativeToken.token = githubChain.token
    if (!chain.nativeToken.decimals) chain.nativeToken.decimals = githubChain.decimals
    chain.nativeToken.id = `${chain.id}-native-${chain.nativeToken}`

    // set values
    chain.name = githubChain.name
    chain.account = githubChain.account
    chain.subscanUrl = githubChain.subscanUrl
    chain.rpcs = (githubChain.rpcs || []).map((url) => new Rpc({ url, isHealthy: false }))
    chain.isTestnet = githubChain.isTestnet || false

    // only set relay and paraId if both exist on githubChain
    if (relay !== null && githubChain.paraId) chain.paraId = githubChain.paraId
    else chain.paraId = null
    if (relay !== null && githubChain.paraId) chain.relay = relay
    else chain.relay = null

    // save
    await store.save(chain)
  }

  // delete chains from db if they're no longer in github chaindata
  if (Object.keys(deleteChainIds).length > 0) await store.delete(Chain, Object.keys(deleteChainIds))

  //
  //
  // RPCS -> DB
  //
  //

  // fetch chains from db
  const chains = await store.find(Chain)

  // sort chains by id
  const sortedChains = sortChains(chains)

  // prepare updates to each chain in parallel
  const chainUpdates = sortedChains.map(
    async (chain): Promise<Chain> => {
      // can't be healthy if chain has no rpcs
      if (!chain.rpcs || chain.rpcs.length < 1) return setUnhealthy(chain)

      // get health status of rpcs
      await Promise.all(
        Object.values(chain.rpcs).map(async (rpc) => {
          // try to connect to rpc
          let socket: WsProvider | null = null
          try {
            socket = new WsProvider(rpc.url, 0, {
              // our extension will send this header with every request
              // some RPCs reject this header, in which case we want to set isHealthy to false
              Origin: 'chrome-extension://abpofhpcakjhnpklgodncneklaobppdc',
            })

            // fetch genesis hash
            await sendWithTimeout(socket, [['chain_getBlockHash', [0]]], chainRpcTimeout)

            // set healthy
            rpc.isHealthy = true
          } catch (error) {
            // set unhealthy
            rpc.isHealthy = false
          } finally {
            socket !== null && socket.disconnect()
          }
        })
      )

      // set chain unhealthy if there is no healthy rpcs
      const healthyChainRpcUrls = chain.rpcs.filter(({ isHealthy }) => isHealthy).map(({ url }) => url)
      if (healthyChainRpcUrls.length < 1) return setUnhealthy(chain)

      // fetch chaindata from rpc
      const maxAttempts = healthyChainRpcUrls.length * 2
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        // try to connect to chain
        let socket: WsProvider | null = null
        try {
          socket = new WsProvider(healthyChainRpcUrls[(attempt - 1) % healthyChainRpcUrls.length], 0, {
            // our extension will send this header with every request
            // some RPCs reject this header, in which case we want to set isHealthy to false
            Origin: 'chrome-extension://abpofhpcakjhnpklgodncneklaobppdc',
          })

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
          const { ss58Format, tokenDecimals, tokenSymbol } = chainProperties
          const registry = getRegistry({
            specName,
            specVersion,
            metadataRpc,
            chainName,
          })
          const metadata: Metadata = createMetadata(registry, metadataRpc)

          const currencyIdDef = (metadata.asLatest.lookup?.types || []).find(
            ({ type }) => type.path.slice(-1).toString() === 'CurrencyId' && type?.def?.isVariant
          )
          const currencyIdVariants = (currencyIdDef?.type?.def?.asVariant?.variants.toJSON() || []) as Array<{
            name: string
            index: number
          }>
          const currencyIdLookup = Object.fromEntries(currencyIdVariants.map(({ name, index }) => [name, index]))
          const tokensCurrencyIdIndex = currencyIdLookup['Token']

          const tokenSymbolDef = (metadata.asLatest.lookup?.types || []).find(
            ({ type }) => type.path.slice(-1).toString() === 'TokenSymbol'
          )
          const tokenSymbolVariants = (tokenSymbolDef?.type?.def?.asVariant?.variants.toJSON() || []) as Array<{
            name: string
            index: number
          }>
          const tokenIndexLookup = Object.fromEntries(tokenSymbolVariants.map(({ name, index }) => [name, index]))

          const tokens = Array.isArray(tokenSymbol)
            ? tokenSymbol
                .map((symbol: string, index: number) => ({
                  id: `${chain.id}-orml-${symbol}`,
                  index: tokenIndexLookup[symbol],
                  token: symbol,
                  decimals: tokenDecimals[index],
                }))
                .filter(({ index }) => index !== undefined)
                .map((token) => new Token(token))
            : []
          tokens.sort((a, b) => (a?.index || 0) - (b?.index || 0))

          const existentialDepositCodec = metadata.asLatest.pallets
            .find((pallet: any) => pallet.name.eq('Balances'))
            ?.constants.find((constant: any) => constant.name.eq('ExistentialDeposit'))?.value
          const existentialDeposit = existentialDepositCodec
            ? hexToBn(existentialDepositCodec.toHex(), {
                isLe: true,
                isNegative: false,
              }).toString()
            : null

          // set values
          chain.chainName = chainName
          chain.implName = implName
          chain.specName = specName
          chain.specVersion = specVersion
          chain.genesisHash = genesisHash
          chain.prefix = ss58Format
          if (!chain.nativeToken) chain.nativeToken = new Token()
          chain.nativeToken.token = Array.isArray(tokenSymbol) ? tokenSymbol[0] : tokenSymbol
          chain.nativeToken.decimals = Array.isArray(tokenDecimals) ? tokenDecimals[0] : tokenDecimals
          chain.nativeToken.existentialDeposit = existentialDeposit
          chain.nativeToken.id = `${chain.id}-native-${chain.nativeToken.token}`
          chain.tokensCurrencyIdIndex = tokensCurrencyIdIndex
          chain.tokens = tokens.length > 0 ? tokens : null
          chain.isHealthy = true

          return chain
        } catch (error) {
          console.warn(chain.id, `attempt ${attempt} failed`, error)
        } finally {
          socket !== null && socket.disconnect()
        }
      }

      // ran out of attempts
      console.warn(chain.id, `all attempts (${maxAttempts}) failed`)
      return setUnhealthy(chain)
    }
  )

  // wait for all chains to be updated
  const chainsUpdated = await Promise.all(chainUpdates)

  // store updated chains in db
  await store.save(chainsUpdated)

  //
  //
  // COINGECKO -> DB
  //
  //

  // get coingecko ids from github chaindata if specified
  const coingeckoChains = await Promise.all(
    githubChains.map(async (githubChain) => {
      const chain = await getOrCreate(store, Chain, githubChain.id)

      // always use coingeckoId from githubChain if it is set
      if (!chain.nativeToken) chain.nativeToken = new Token()
      chain.nativeToken.rates = null
      chain.nativeToken.coingeckoId = githubChain.coingeckoId
      ;(chain.tokens || []).forEach((token) => {
        token.rates = null
        if (token.token && githubChain.tokensCoingeckoIds) {
          token.coingeckoId = githubChain.tokensCoingeckoIds[token.token]
        } else {
          token.coingeckoId = undefined
        }
      })

      return chain
    })
  )

  // get remaining coingecko ids from coingecko via token symbols
  const coingeckoList: Array<{ id: string; symbol: string; name: string }> = await axios
    .get(`${coingeckoApiUrl}/coins/list`)
    .then((response) => response.data)
  const coingeckoSymbolIndex = Object.fromEntries(
    coingeckoList.reverse().map((coin) => [coin.symbol.toUpperCase(), coin])
  )

  const fetchCoingeckoIds = coingeckoChains
    .flatMap((chain: Chain) => {
      if (chain.isTestnet) return

      if (chain.nativeToken && chain.nativeToken.token) {
        if (chain.nativeToken.coingeckoId === undefined) {
          chain.nativeToken.coingeckoId = coingeckoSymbolIndex[chain.nativeToken.token.toUpperCase()]?.id
        }
      }

      const ormlTokensCoingeckoIds = (chain.tokens || []).map((token) => {
        if (!token.token) return
        if (token.coingeckoId !== undefined) return token.coingeckoId

        token.coingeckoId = coingeckoSymbolIndex[token.token.toUpperCase()]?.id
        return token.coingeckoId
      })

      return [chain.nativeToken?.coingeckoId, ...ormlTokensCoingeckoIds]
    })
    .filter(Boolean)

  const fetchCoingeckoIdsSerialized = fetchCoingeckoIds.join(',')
  const coingeckoCurrenciesSerialized = coingeckoCurrencies.join(',')
  const coingeckoPrices: Record<string, Record<string, number>> = await axios
    .get(
      `${coingeckoApiUrl}/simple/price?ids=${fetchCoingeckoIdsSerialized}&vs_currencies=${coingeckoCurrenciesSerialized}`
    )
    .then((response) => response.data)

  coingeckoChains.forEach((chain: Chain) => {
    if (chain.nativeToken && chain.nativeToken.coingeckoId) {
      chain.nativeToken.rates = new Rates()

      const rates = coingeckoPrices[chain.nativeToken.coingeckoId]
      if (rates) {
        for (const currency of coingeckoCurrencies) {
          chain.nativeToken.rates[currency] = rates[currency]
        }
      }
    }
    ;(chain.tokens || []).map((token) => {
      if (!token.coingeckoId) return
      token.rates = new Rates()

      const rates = coingeckoPrices[token.coingeckoId]
      if (rates) {
        for (const currency of coingeckoCurrencies) {
          token.rates[currency] = rates[currency]
        }
      }
    })
  })

  // update deprecated fields e.g. `chain.token = chain.nativeToken.token`
  await store.save(updateDeprecatedFields(coingeckoChains))
})

// indexer breaks if we don't subscribe to at least one type of event in addition to the postBlock hook
processor.addEventHandler('balances.Transfer', async () => {})

// run the processor on start
processor.run()
