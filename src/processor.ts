import { lookupArchive } from '@subsquid/archive-registry'
import { BlockHandlerContext, SubstrateProcessor } from '@subsquid/substrate-processor'
import { FullTypeormDatabase } from '@subsquid/typeorm-store'
import { startCase } from 'lodash'
import { EntityManager } from 'typeorm'

import { fetchDataForChains } from './steps/fetchDataForChains'
import { fetchDataFromGithub } from './steps/fetchDataFromGithub'
import { setInvalidTokenLogosToCoingeckoOrChainLogo } from './steps/setInvalidTokenLogosToCoingeckoOrChainLogo'
import { updateChainsFromGithub } from './steps/updateChainsFromGithub'
import { updateEvmNetworksFromGithub } from './steps/updateEvmNetworksFromGithub'
import { updateSortIndexes } from './steps/updateSortIndexes'
import { updateTokensFromGithub } from './steps/updateTokensFromGithub'

const numBlocksPerExecution = 50 // only run every 50 blocks ≈ 5 minutes at 6s / block
const skipBlocksOlderThan = 86_400_000 // 86,400 seconds = skip execution for any blocks older than 24 hours

const processor = new SubstrateProcessor(new FullTypeormDatabase())
processor.setBatchSize(500)
processor.setBlockRange({ from: 13_740_000 })
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
  updateTokensFromGithub,
  setInvalidTokenLogosToCoingeckoOrChainLogo,
]
