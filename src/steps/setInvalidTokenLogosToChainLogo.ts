import { BlockHandlerContext } from '@subsquid/substrate-processor'
import axios from 'axios'
import { EntityManager } from 'typeorm'

import { Chain, EvmNetwork, Token } from '../model'
import { githubUnknownTokenLogoUrl } from '../steps/_constants'

export async function setInvalidTokenLogosToChainLogo({ store }: BlockHandlerContext<EntityManager>) {
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
}
