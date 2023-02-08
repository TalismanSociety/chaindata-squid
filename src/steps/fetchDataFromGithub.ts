import axios from 'axios'

import { GithubChain } from '../types'
import { githubChainsUrl, githubEvmNetworksUrl, githubTestnetChainsUrl, githubTokensUrl } from './_constants'
import { processorSharedData } from './_sharedData'

const wtfVersion = 1
const wtf = `v=wtf${wtfVersion}`

export async function fetchDataFromGithub() {
  // fetch chains, evmNetworks and tokens from chaindata github repo
  const [githubChains, githubTestnetChains, githubEvmNetworks, githubTokens] = await Promise.all([
    axios.get(`${githubChainsUrl}?${wtf}`).then((response) => response.data),
    axios
      .get(`${githubTestnetChainsUrl}?${wtf}`)
      .then((response) => response.data)
      .then((data) => data?.map?.((chain: GithubChain) => ({ ...chain, isTestnet: true }))),
    axios.get(`${githubEvmNetworksUrl}?${wtf}`).then((response) => response.data),
    axios.get(`${githubTokensUrl}?${wtf}`).then((response) => response.data),
  ])

  if (!Array.isArray(githubChains) || githubChains.length < 1)
    throw new Error(`Failed to fetch chains from github. Aborting update.`)
  if (!Array.isArray(githubTestnetChains) || githubTestnetChains.length < 1)
    throw new Error(`Failed to fetch testnet chains from github. Aborting update.`)
  if (!Array.isArray(githubEvmNetworks) || githubEvmNetworks.length < 1)
    throw new Error(`Failed to fetch evm networks from github. Aborting update.`)
  if (!Array.isArray(githubTokens) || githubTokens.length < 1)
    throw new Error(`Failed to fetch tokens from github. Aborting update.`)

  processorSharedData.githubChains = [...githubChains, ...githubTestnetChains]
  processorSharedData.githubEvmNetworks = githubEvmNetworks
  processorSharedData.githubTokens = githubTokens
}
