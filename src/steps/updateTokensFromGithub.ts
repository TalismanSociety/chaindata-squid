import { BlockHandlerContext } from '@subsquid/substrate-processor'
import { EntityManager } from 'typeorm'

import { Token } from '../model'
import { processorSharedData } from './_sharedData'

export async function updateTokensFromGithub({ store }: BlockHandlerContext<EntityManager>) {
  const { githubTokens } = processorSharedData

  // override symbol / decimals / coingeckoId for tokens
  for (const githubToken of githubTokens) {
    const token = await store.findOne(Token, {
      where: { id: githubToken.id },
      loadRelationIds: { disableMixedMap: true },
    })
    if (!token) continue

    const data = token.data as any
    if (data === undefined) continue

    if (githubToken.symbol) (token.data as any).symbol = githubToken.symbol
    if (githubToken.decimals) (token.data as any).decimals = githubToken.decimals
    if (githubToken.coingeckoId) (token.data as any).coingeckoId = githubToken.coingeckoId

    await store.save(token)
  }
}
