import { EvmErc20Module } from '@talismn/balances-evm-erc20'
import { EvmNativeModule } from '@talismn/balances-evm-native'
import { SubNativeModule } from '@talismn/balances-substrate-native'
import { SubOrmlModule } from '@talismn/balances-substrate-orml'

export {
  githubChainsUrl,
  githubTestnetChainsUrl,
  githubEvmNetworksUrl,
  githubTokensUrl,
  githubChainLogoUrl,
  githubEvmNetworkLogoUrl,
  githubTokenLogoUrl,
  githubUnknownTokenLogoUrl,
} from '@talismn/chaindata-provider'

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
