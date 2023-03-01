import { BlockHandlerContext } from '@subsquid/substrate-processor'
import { EntityManager } from 'typeorm'

import { Chain, Token } from '../model'
import { processorSharedData } from './_sharedData'

export async function applyNativeTokenOverrides({ store, log }: BlockHandlerContext<EntityManager>) {
  const chains = await store.find(Chain, { loadRelationIds: { disableMixedMap: true } })

  for (const chain of chains) {
    const overrideNativeTokenId = processorSharedData.githubChains.find(
      ({ id }) => id === chain.id
    )?.overrideNativeTokenId
    if (typeof overrideNativeTokenId !== 'string') continue

    const haveNewNativeToken = await store.exists(Token, { where: { id: overrideNativeTokenId } })
    if (!haveNewNativeToken) {
      log.error(
        `Ignoring nativeToken override ${overrideNativeTokenId} for chain ${chain.id}: override token does not exist!`
      )
      continue
    }

    await store.update(Chain, { id: chain.id }, { nativeToken: { id: overrideNativeTokenId } })
  }
}
