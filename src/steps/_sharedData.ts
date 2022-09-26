import { GithubChain, GithubEvmNetwork, GithubToken } from '../types'

export const processorSharedData: {
  githubChains: GithubChain[]
  githubEvmNetworks: GithubEvmNetwork[]
  githubTokens: GithubToken[]
} = { githubChains: [], githubEvmNetworks: [], githubTokens: [] }
