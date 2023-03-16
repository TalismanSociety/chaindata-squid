import { BlockHandlerContext } from '@subsquid/substrate-processor'
import { EntityManager } from 'typeorm'

import { getOrCreate } from '../helpers'
import { BalanceModuleConfig, Chain, SubstrateRpc } from '../model'
import { githubChainLogoUrl } from './_constants'
import { processorSharedData } from './_sharedData'

export async function updateChainsFromGithub({ store }: BlockHandlerContext<EntityManager>) {
  const deletedChainIdsMap = Object.fromEntries((await store.find(Chain)).map((chain) => [chain.id, true]))

  // add github chains to the db
  for (const githubChain of processorSharedData.githubChains) {
    if (typeof githubChain?.id !== 'string') continue

    // don't delete this chain
    delete deletedChainIdsMap[githubChain.id]

    const chain = await getOrCreate(store, Chain, githubChain.id)
    const relay = githubChain.relay?.id ? await store.findOne(Chain, { where: { id: githubChain.relay.id } }) : null

    // set values
    chain.isTestnet = githubChain.isTestnet || false
    chain.name = githubChain.name
    chain.logo = githubChainLogoUrl(chain.id)
    chain.account = githubChain.account
    chain.subscanUrl = githubChain.subscanUrl
    chain.chainspecQrUrl = githubChain.chainspecQrUrl
    chain.latestMetadataQrUrl = githubChain.latestMetadataQrUrl
    chain.rpcs = (githubChain.rpcs || []).map((url) => new SubstrateRpc({ url, isHealthy: false }))
    if (!chain.balanceMetadata) chain.balanceMetadata = []

    // only set relay and paraId if both exist on githubChain
    // TODO: Figure out parachains automatically
    chain.paraId = relay !== null && githubChain.paraId ? githubChain.paraId : null
    chain.relay = relay !== null && githubChain.paraId ? relay : null

    chain.balanceModuleConfigs = Object.entries(githubChain.balanceModuleConfigs || {}).map(
      ([moduleType, moduleConfig]) => new BalanceModuleConfig({ moduleType, moduleConfig })
    )

    // used to override the auto-calculated theme color
    if (typeof githubChain.themeColor === 'string')
      processorSharedData.userDefinedThemeColors.chains.set(githubChain.id, githubChain.themeColor)

    // save
    await store.save(chain)
  }

  // delete chains from db if they're no longer in github chaindata
  const deletedChainIds = Object.keys(deletedChainIdsMap)
  if (deletedChainIds.length > 0) await store.delete(Chain, deletedChainIds)
}
