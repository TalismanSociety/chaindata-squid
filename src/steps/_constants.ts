import { EvmErc20Module } from '@talismn/balances-evm-erc20'
import { EvmNativeModule } from '@talismn/balances-evm-native'
import { SubNativeModule } from '@talismn/balances-substrate-native'
import { SubOrmlModule } from '@talismn/balances-substrate-orml'

export const githubChaindataBranch = 'feat/split-entities' // 'main'
export const githubChaindataBaseUrl = `https://raw.githubusercontent.com/TalismanSociety/chaindata/${githubChaindataBranch}`
export const githubChainsUrl = `${githubChaindataBaseUrl}/chaindata.json`
export const githubTestnetChainsUrl = `${githubChaindataBaseUrl}/testnets-chaindata.json`
export const githubEvmNetworksUrl = `${githubChaindataBaseUrl}/evm-networks.json`
export const githubTokensUrl = `${githubChaindataBaseUrl}/tokens.json`
export const githubChainLogoUrl = (chainId: string) => `githubChaindataBaseUrl/assets/${chainId}/logo.svg`
export const githubEvmNetworkLogoUrl = (networkId: string) => `githubChaindataBaseUrl/assets/${networkId}/logo.svg`
export const githubTokenLogoUrl = (tokenId: string) => `githubChaindataBaseUrl/token-assets/${tokenId}.svg`

export const balanceModules: any[] = [
  // ExampleModule,
  SubNativeModule,
  SubOrmlModule,
  EvmNativeModule,
  EvmErc20Module,
]

export const processSubstrateChainsConcurrency = 20

// chain rpc is set to unhealthy if it doesn't respond before this timeout
export const chainRpcTimeout = 120_000 // 120_000ms = 120 seconds = 2 minutes timeout on RPC requests
