import { BlockHandlerContext } from '@subsquid/substrate-processor'
import axios from 'axios'
import uniq from 'lodash/uniq'
import { EntityManager } from 'typeorm'

import { CachedCoingeckoLogo, Chain, EvmNetwork, Token } from '../model'
import { githubUnknownTokenLogoUrl } from '../steps/_constants'

export async function setInvalidTokenLogosToCoingeckoOrChainLogo({ store }: BlockHandlerContext<EntityManager>) {
  const chains = await store.find(Chain, { loadRelationIds: { disableMixedMap: true } })
  const evmNetworks = await store.find(EvmNetwork, { loadRelationIds: { disableMixedMap: true } })
  const tokens = await store.find(Token, { loadRelationIds: { disableMixedMap: true } })

  await cacheSomeMoreCoingeckoLogoUrls(store, tokens)
  const cachedCoingeckoLogos = Object.fromEntries(
    (await store.find(CachedCoingeckoLogo)).map((coingeckoLogo) => [coingeckoLogo.id, coingeckoLogo])
  )

  await Promise.all(
    tokens.map(async (token) => {
      try {
        const data = token.data as any
        if (data === undefined) return

        const chainId = data.chain?.id || data.evmNetwork?.id
        const chainLogo = [...chains, ...evmNetworks].find(({ id }) => chainId === id)?.logo

        // try logo from token's balance module
        if (typeof data.logo === 'string' && data.logo !== chainLogo && data.logo !== githubUnknownTokenLogoUrl) {
          const resp = await axios.get(data.logo, { validateStatus: () => true })
          if (resp.status !== 404) return
        }

        // next try coingecko logo
        if (typeof data.coingeckoId === 'string' && !['substrate-native', 'evm-native'].includes(data.type)) {
          ;(token.data as any).logo = cachedCoingeckoLogos[data.coingeckoId]?.url

          if (data.logo !== undefined) {
            const resp = await axios.get(data.logo, { validateStatus: () => true })
            if (resp.status !== 404) return
          }
        }

        // next try chain logo
        if (typeof chainLogo === 'string') {
          ;(token.data as any).logo = chainLogo
          const resp = await axios.get(data.logo, { validateStatus: () => true })
          if (resp.status !== 404) return
        }

        // fall back to unknown logo
        ;(token.data as any).logo = githubUnknownTokenLogoUrl
      } catch (error) {
        console.error(token.id, (error as any)?.code ? (error as any).code : error)
      }
    })
  )

  await store.save(tokens)
}

const cacheSomeMoreCoingeckoLogoUrls = async (store: EntityManager, tokens: Token[]) => {
  const cachedCoingeckoLogos = Object.fromEntries(
    (await store.find(CachedCoingeckoLogo)).map((coingeckoLogo) => [coingeckoLogo.id, coingeckoLogo])
  )

  const allCoingeckoIds = uniq(
    tokens
      .filter((token) => typeof (token.data as any)?.coingeckoId === 'string')
      .map((token) => (token.data as { coingeckoId: string }).coingeckoId)
  )

  const now = Date.now()
  const updateRate = 10_800_000 // 3 hrs * 60 mins * 60 secs * 1000 ms
  const updateCoingeckoIds = allCoingeckoIds
    // filter out logos which exist in our cache and are not too old
    .filter(
      (id) => !cachedCoingeckoLogos[id] || now - (parseInt(cachedCoingeckoLogos[id].lastUpdated, 10) ?? 0) > updateRate
    )
    // fetch the first 250 uncached logos
    .slice(0, 250)

  const { data } = await axios.get(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${updateCoingeckoIds.join(',')}&per_page=250`,
    {
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': '*',
      },
    }
  )
  if (!data || !Array.isArray(data)) return

  const cacheUpdates = data
    .filter((token) => typeof token?.id === 'string' && typeof token?.image === 'string')
    .map(
      (token) =>
        new CachedCoingeckoLogo({
          id: token.id,
          url: token.image,
          lastUpdated: now.toString(),
        })
    )

  await store.save(cacheUpdates)
}
