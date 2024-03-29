export type GithubChain = {
  id: string
  isTestnet?: true
  name?: string
  themeColor?: string
  account?: string
  subscanUrl?: string
  chainspecQrUrl?: string
  latestMetadataQrUrl?: string
  overrideNativeTokenId?: string
  isUnknownFeeToken?: boolean
  rpcs?: string[]
  paraId?: number
  relay?: { id: string }
  balanceModuleConfigs?: Record<string, Record<string, unknown>>
}

export type GithubEvmNetwork = {
  substrateChainId?: string
  name?: string
  themeColor?: string
  isTestnet?: true
  explorerUrl?: string
  rpcs?: string[]
  balanceModuleConfigs?: Record<string, Record<string, unknown>>
}

export type GithubToken = {
  id: string
  symbol?: string
  themeColor?: string
  decimals?: number
  coingeckoId?: string | null
  dcentName?: string | null
  mirrorOf?: string | null
}

// Some handy types from https://www.typescriptlang.org/docs/handbook/advanced-types.html#distributive-conditional-types
export type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never
}[keyof T]
export type FunctionProperties<T> = Pick<T, FunctionPropertyNames<T>>
export type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? never : K
}[keyof T]
export type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>
