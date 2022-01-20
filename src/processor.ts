import axios from 'axios'
import { Store, SubstrateProcessor } from '@subsquid/substrate-processor'
import { createMetadata, getRegistry } from '@substrate/txwrapper-polkadot'
import { WsProvider } from '@polkadot/api'
import { hexToBn } from '@polkadot/util'
import { Chain } from './model'

const processor = new SubstrateProcessor('chaindata')

const numBlocksPerExecution = 50 // only run every 50 blocks ≈ 5 minutes at 6s / block
const skipBlocksOlderThan = 300_000 // 300_000ms = 300 seconds = skip execution for any blocks older than 5 minutes
const githubChaindataUrl =
    'https://raw.githubusercontent.com/TalismanSociety/chaindata/graphql-chaindata-imitator/chaindata.json'

// chain is set to unhealthy if RPC doesn't respond before this timeout
const chainRpcTimeout = 120_000 // 120_000ms = 120 seconds = 2 minutes timeout on RPC requests

processor.setTypesBundle('kusama')
processor.setBatchSize(500)
processor.setBlockRange({ from: 11_040_000 })

processor.setDataSource({
    archive: 'https://kusama.indexer.gc.subsquid.io/v4/graphql',
    chain: 'wss://kusama-rpc.polkadot.io',
})

processor.addPostHook(async ({ block, store }) => {
    const blockHeight = block.height
    const blockTimestamp = block.timestamp

    // only run every n blocks
    if (blockHeight % numBlocksPerExecution !== 0) return

    // skip blocks older than n
    if (Date.now() - blockTimestamp > skipBlocksOlderThan) return

    console.debug(`executing on block ${blockHeight}: block is recent and a multiple of ${numBlocksPerExecution}`)

    // fetch github chaindata
    const githubChaindataResponse = await axios.get(githubChaindataUrl)
    const githubChaindata: GithubChain[] = githubChaindataResponse.data

    for (const githubChain of githubChaindata) {
        const chain = await getOrCreate(store, Chain, githubChain.id)
        const relay = githubChain.relay?.id ? await getOrCreate(store, Chain, githubChain.relay.id) : null

        // only use githubChain value if db doesn't already have a value for this chain
        // values fetched via RPC will therefore take precedence
        if (!chain.prefix) chain.prefix = githubChain.prefix
        if (!chain.token) chain.token = githubChain.token
        if (!chain.decimals) chain.decimals = githubChain.decimals

        // set values
        chain.name = githubChain.name
        chain.account = githubChain.account
        chain.rpcs = githubChain.rpcs || []

        // only set relay and paraId if both exist on githubChain
        if (relay !== null && githubChain.paraId) chain.paraId = githubChain.paraId
        if (relay !== null && githubChain.paraId) chain.relay = relay

        // save
        await store.save(chain)
    }

    // fetch chains from db
    const chains = await store.find(Chain)

    // sort chains by id
    chains.sort((a, b) => {
        if (a.id === b.id) return 0
        if (a.id === 'polkadot') return -1
        if (b.id === 'polkadot') return 1
        if (a.id === 'kusama') return -1
        if (b.id === 'kusama') return 1
        return a.id.localeCompare(b.id)
    })

    // prepare updates to each chain in parallel
    const chainUpdates = chains.map(async (chain, sortIndex): Promise<Chain> => {
        if (chain.sortIndex !== sortIndex) chain.sortIndex = sortIndex

        // can't be healthy if chain has no rpcs
        if (!chain.rpcs) return setUnhealthy(chain)

        // fetch chaindata from rpc
        const maxAttempts = chain.rpcs.length
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            // try to connect to chain
            let socket: WsProvider | null = null
            try {
                socket = new WsProvider(chain.rpcs, 0)

                // fetch rpc data
                const [genesisHash, runtimeVersion, metadataRpc, chainName, chainProperties] = await sendWithTimeout(
                    socket,
                    [
                        ['chain_getBlockHash', [0]],
                        ['state_getRuntimeVersion', []],
                        ['state_getMetadata', []],
                        ['system_chain', []],
                        ['system_properties', []],
                    ],
                    chainRpcTimeout
                )

                // deconstruct rpc data
                const { specName, specVersion, implName } = runtimeVersion
                const { ss58Format, tokenDecimals, tokenSymbol } = chainProperties
                const registry = getRegistry({
                    specName,
                    specVersion,
                    metadataRpc,
                    chainName,
                })
                const metadata = createMetadata(registry, metadataRpc)

                const existentialDepositCodec = metadata.asLatest.pallets
                    .find((pallet: any) => pallet.name.eq('Balances'))
                    ?.constants.find((constant: any) => constant.name.eq('ExistentialDeposit'))?.value
                const existentialDeposit = existentialDepositCodec
                    ? hexToBn(existentialDepositCodec.toHex(), {
                          isLe: true,
                          isNegative: false,
                      }).toString()
                    : null

                // set values
                chain.chainName = chainName
                chain.implName = implName
                chain.specName = specName
                chain.specVersion = specVersion
                chain.genesisHash = genesisHash
                chain.prefix = ss58Format
                chain.token = Array.isArray(tokenSymbol) ? tokenSymbol[0] : tokenSymbol
                chain.decimals = Array.isArray(tokenDecimals) ? tokenDecimals[0] : tokenDecimals
                chain.existentialDeposit = existentialDeposit
                chain.isHealthy = true

                return chain
            } catch (error) {
                console.warn(chain.id, `attempt ${attempt} failed`, error)
            } finally {
                socket !== null && socket.disconnect()
            }
        }

        // ran out of attempts
        console.warn(chain.id, `all attempts (${maxAttempts}) failed`)
        return setUnhealthy(chain)
    })

    // wait for all chains to be updated
    const chainsUpdated = await Promise.all(chainUpdates)

    // store updated chains in db
    await store.save(chainsUpdated)
})

// indexer breaks if we don't subscribe to at least one type of event in addition to the postBlock hook
processor.addEventHandler('balances.Transfer', async () => {})

processor.run()

async function getOrCreate<T extends { id: string }>(
    store: Store,
    entityConstructor: EntityConstructor<T>,
    id: string
): Promise<T> {
    let e = await store.get<T>(entityConstructor, {
        where: { id },
    })

    if (e == null) {
        e = new entityConstructor()
        e.id = id
    }

    return e
}

type EntityConstructor<T> = {
    new (...args: any[]): T
}

const setUnhealthy = (chain: Chain): Chain => {
    if (chain.isHealthy) chain.isHealthy = false
    return chain
}

type GithubChain = {
    id: string
    prefix?: number | null
    name?: string | null
    token?: string | null
    decimals?: number | null
    account?: string | null
    rpcs?: string[] | null
    paraId?: number | null
    relay?: { id: string } | null
}

const sendWithTimeout = (socket: WsProvider, requests: Array<[string, any?]>, timeout: number): Promise<any[]> => {
    return new Promise(async (_resolve, _reject) => {
        let done = false
        const resolve = (value: any[]) => {
            done = true
            _resolve(value)
        }
        const reject = (reason?: any) => {
            done = true
            _reject(reason)
        }

        if (socket === null) return reject('no socket')
        socket.on('error', () => reject('socket error'))

        setTimeout(() => !done && reject('timeout'), timeout)

        await socket.connect()
        await socket.isReady

        const results = await Promise.all(requests.map(([method, params = []]) => socket.send(method, params)))

        resolve(results)
    })
}
