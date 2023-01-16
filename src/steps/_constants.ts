import { balanceModules as defaultBalanceModules } from '@talismn/balances-default-modules'

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

export const balanceModules = defaultBalanceModules

export const processSubstrateChainsConcurrency = 20

// chain rpc is set to unhealthy if it doesn't respond before this timeout
export const chainRpcTimeout = 120_000 // 120_000ms = 120 seconds = 2 minutes timeout on RPC requests
