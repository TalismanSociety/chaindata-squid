import { balanceModules as defaultBalanceModules } from '@talismn/balances-default-modules'
import { githubChainLogoUrl } from '@talismn/chaindata-provider'

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

// TODO: Update @talismn/chaindata-provider and import `githubUnknownChainLogoUrl` from there
export const githubUnknownChainLogoUrl = githubChainLogoUrl('unknown')

export const balanceModules = defaultBalanceModules

export const processSubstrateChainsConcurrency = 20

// chain rpc is set to unhealthy if it doesn't respond before this timeout
export const chainRpcTimeout = 120_000 // 120_000ms = 120 seconds = 2 minutes timeout on RPC requests
