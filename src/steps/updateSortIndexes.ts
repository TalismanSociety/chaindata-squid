import { BlockHandlerContext } from '@subsquid/substrate-processor'
import { EntityManager } from 'typeorm'

import { sortChainsAndNetworks } from '../helpers'
import { Chain, EvmNetwork } from '../model'

export async function updateSortIndexes({ store }: BlockHandlerContext<EntityManager>) {
  const chains = await store.find(Chain, { loadRelationIds: { disableMixedMap: true } })
  const evmNetworks = await store.find(EvmNetwork, { loadRelationIds: { disableMixedMap: true } })

  const sorted = sortChainsAndNetworks(chains, evmNetworks)

  await store.save(sorted)
}
