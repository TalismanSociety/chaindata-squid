import { lookupArchive } from '@subsquid/archive-registry'
import { BlockHandlerContext, SubstrateProcessor } from '@subsquid/substrate-processor'
import { FullTypeormDatabase } from '@subsquid/typeorm-store'
import axios from 'axios'
import { startCase } from 'lodash'
import { EntityManager } from 'typeorm'

import { Chain, EvmNetwork, Token } from './model'
import { githubUnknownTokenLogoUrl } from './steps/_constants'
import { fetchDataForChains } from './steps/fetchDataForChains'
import { fetchDataFromGithub } from './steps/fetchDataFromGithub'
import { updateChainsFromGithub } from './steps/updateChainsFromGithub'
import { updateEvmNetworksFromGithub } from './steps/updateEvmNetworksFromGithub'
import { updateSortIndexes } from './steps/updateSortIndexes'

const numBlocksPerExecution = 50 // only run every 50 blocks ≈ 5 minutes at 6s / block
const skipBlocksOlderThan = 86_400_000 // 86,400 seconds = skip execution for any blocks older than 24 hours

const processor = new SubstrateProcessor(new FullTypeormDatabase())
processor.setBatchSize(500)
processor.setBlockRange({ from: 12_100_000 })
processor.setDataSource({
  chain: 'wss://rpc.polkadot.io',
  archive: lookupArchive('polkadot', { release: 'FireSquid' }),
})

processor.addPostHook(async (context) => {
  const { block, log } = context

  const blockHeight = block.height
  const blockTimestamp = block.timestamp

  // only run every n blocks
  if (blockHeight % numBlocksPerExecution !== 0) return

  // skip blocks older than n
  if (Date.now() - blockTimestamp > skipBlocksOlderThan) return

  log.debug(`Executing on block ${blockHeight}: block is recent and a multiple of ${numBlocksPerExecution}`)

  for (const [index, executeStep] of processorSteps.entries()) {
    log.info(`Executing step ${index + 1}: ${startCase(executeStep.name)}`)
    await executeStep(context)
  }
})

// indexer breaks if we don't subscribe to at least one type of event in addition to the postBlock hook
processor.addEventHandler('Balances.Transfer', async () => {})

// run the processor on start
processor.run()

//
// processor steps
//

const processorSteps: Array<(context: BlockHandlerContext<EntityManager>) => Promise<void>> = [
  fetchDataFromGithub,
  updateChainsFromGithub,
  fetchDataForChains,
  updateEvmNetworksFromGithub,
  updateSortIndexes,

  async function setInvalidTokenLogosToChainLogo({ store }) {
    const chains = await store.find(Chain, { loadRelationIds: { disableMixedMap: true } })
    const evmNetworks = await store.find(EvmNetwork, { loadRelationIds: { disableMixedMap: true } })
    const tokens = await store.find(Token, { loadRelationIds: { disableMixedMap: true } })

    await Promise.all(
      tokens.map(async (token) => {
        const data = token.data as any
        if (data === undefined) return

        const chainId = data.chain?.id || data.evmNetwork?.id
        const chainLogo = [...chains, ...evmNetworks].find(({ id }) => chainId === id)?.logo

        if (typeof data.logo !== 'string') (token.data as any).logo = chainLogo

        const resp = await axios.get(data.logo, { validateStatus: () => true })
        if (resp.status !== 404) return

        if (data.logo !== chainLogo) {
          ;(token.data as any).logo = chainLogo
          const resp = await axios.get(data.logo, { validateStatus: () => true })
          if (resp.status !== 404) return
        }

        ;(token.data as any).logo = githubUnknownTokenLogoUrl
      })
    )

    await store.save(tokens)
  },

  // async function updateTokensFromGithub({ store }) {
  //   const { githubTokens } = processorSharedData

  //   // rename / set coingeckoId for tokens
  //   const isRenameOrCoingeckoId = (token: GithubToken) =>
  //     typeof token.id !== 'undefined' &&
  //     (typeof token.coingeckoId !== 'undefined' || typeof token.symbol !== 'undefined')
  //   for (const renameOrCoingeckoId of githubTokens.filter(isRenameOrCoingeckoId)) {
  //     const tokenEntity = await store.findOne(Token, {
  //       where: { id: renameOrCoingeckoId.id },
  //       loadRelationIds: { disableMixedMap: true },
  //     })
  //     if (!tokenEntity) continue

  //     const token = tokenEntity.squidImplementationDetail
  //     if (renameOrCoingeckoId.symbol) token.symbol = renameOrCoingeckoId.symbol
  //     if (renameOrCoingeckoId.coingeckoId) token.coingeckoId = renameOrCoingeckoId.coingeckoId

  //     await saveToken(store, token)
  //   }

  //   // add preconfigured erc20 tokens
  //   const isErc20 = (token: GithubToken) =>
  //     typeof token.contractAddress !== 'undefined' && typeof token.evmNetworkId !== 'undefined'
  //   const existingErc20Tokens = (await store.find(Token, { loadRelationIds: { disableMixedMap: true } })).filter(
  //     (token) => token.squidImplementationDetail.isTypeOf === 'Erc20Token'
  //   )
  //   const deletedTokensMap = Object.fromEntries(existingErc20Tokens.map((token) => [token.id, token]))

  //   for (const erc20 of githubTokens.filter(isErc20)) {
  //     const evmNetwork = await store.findOne(EvmNetwork, {
  //       where: { id: erc20.evmNetworkId?.toString() },
  //       loadRelationIds: { disableMixedMap: true },
  //     })
  //     if (!evmNetwork) continue

  //     const token = await getOrCreateToken(store, Erc20Token, erc20TokenId(evmNetwork.id, erc20.contractAddress))
  //     delete deletedTokensMap[token.id]

  //     // TODO: Import erc20 abi and fetch `symbol` and `decimals` from the evm network rpc
  //     token.symbol = erc20.symbol
  //     token.decimals = erc20.decimals
  //     token.coingeckoId = erc20.coingeckoId
  //     token.contractAddress = erc20.contractAddress
  //     // TODO: Add support for erc20 tokens on substrate networks (e.g. acala)
  //     // token.chain =
  //     token.evmNetwork = evmNetwork.id

  //     await saveToken(store, token)
  //   }

  //   for (const deletedToken of Object.values(deletedTokensMap)) {
  //     await store.remove(deletedToken)
  //   }
  // },
]
