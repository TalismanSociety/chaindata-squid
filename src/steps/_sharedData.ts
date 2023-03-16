import { ChainId, EvmNetworkId, TokenId } from '@talismn/chaindata-provider'

import { GithubChain, GithubEvmNetwork, GithubToken } from '../types'

export const processorSharedData: {
  githubChains: GithubChain[]
  githubEvmNetworks: GithubEvmNetwork[]
  githubTokens: GithubToken[]
  userDefinedThemeColors: {
    chains: Map<ChainId, string>
    evmNetworks: Map<EvmNetworkId, string>
    tokens: Map<TokenId, string>
  }
} = {
  githubChains: [],
  githubEvmNetworks: [],
  githubTokens: [],
  userDefinedThemeColors: { chains: new Map(), evmNetworks: new Map(), tokens: new Map() },
}
