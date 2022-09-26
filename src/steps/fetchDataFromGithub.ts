import axios from 'axios'

import { GithubChain } from '../types'
import { githubChainsUrl, githubEvmNetworksUrl, githubTestnetChainsUrl, githubTokensUrl } from './_constants'
import { processorSharedData } from './_sharedData'

export async function fetchDataFromGithub() {
  // fetch chains, evmNetworks and tokens from chaindata github repo
  const [githubChains, githubEvmNetworks, githubTokens] = await Promise.all([
    (
      await Promise.all([
        axios.get(githubChainsUrl).then((response) => response.data),
        axios
          .get(githubTestnetChainsUrl)
          .then((response) => response.data)
          .then((data) => data.map((chain: GithubChain) => ({ ...chain, isTestnet: true }))),
      ])
    ).flatMap((chains) => chains),
    axios.get(githubEvmNetworksUrl).then((response) => response.data),
    axios.get(githubTokensUrl).then((response) => response.data),
  ])

  processorSharedData.githubChains = githubChains
  processorSharedData.githubEvmNetworks = githubEvmNetworks
  processorSharedData.githubTokens = githubTokens
}
