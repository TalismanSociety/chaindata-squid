import { BlockHandlerContext } from '@subsquid/substrate-processor'
import axios from 'axios'
import pMap from 'p-map'
import { EntityManager } from 'typeorm'

import { Chain } from '../model'
import { githubChainLogoUrl, githubUnknownChainLogoUrl, githubUnknownTokenLogoUrl } from '../steps/_constants'

export async function setInvalidChainLogosToUnknownLogo({ store }: BlockHandlerContext<EntityManager>) {
  const chains = await store.find(Chain, { loadRelationIds: { disableMixedMap: true } })

  await pMap(
    chains,
    async (chain) => {
      try {
        // try githubChainLogoUrl
        chain.logo = githubChainLogoUrl(chain.id)
        const resp = await axios.get(chain.logo, { validateStatus: () => true })
        if (resp.status !== 404) return

        // fall back to unknown logo
        chain.logo = githubUnknownChainLogoUrl
      } catch (error) {
        console.error(chain.id, (error as any)?.code ? (error as any).code : error)
      }
    },
    { concurrency: 20 }
  )

  await store.save(chains)
}
