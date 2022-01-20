import https from 'https'
import { Store, SubstrateProcessor } from '@subsquid/substrate-processor'
import { createMetadata, getRegistry } from '@substrate/txwrapper-polkadot'
import { WsProvider } from '@polkadot/api'
import { hexToBn } from '@polkadot/util'
import { Chain } from './model'

const processor = new SubstrateProcessor('chaindata')

processor.setTypesBundle('kusama')
processor.setBatchSize(500)
processor.setBlockRange({ from: 10_950_000 })

processor.setDataSource({
    archive: 'https://kusama.indexer.gc.subsquid.io/v4/graphql',
    chain: 'wss://kusama-rpc.polkadot.io',
})

processor.addPostHook(async ({ block, store }) => {
    const blockHeight = block.height
    const blockTimestamp = block.timestamp

    // console.debug(`block ${blockHeight} timestamp ${block.timestamp}`)

    // only run every 50 blocks ≈ 5 minutes at 6s / block
    if (blockHeight % 50 !== 0) return

    // console.debug(`block ${blockHeight} timestamp ${block.timestamp}: 10th block!`)

    // ignore if block timestamp is greater than 300 seconds ago (5 minutes)
    if (Date.now() - blockTimestamp > 300_000) return

    console.debug(
        `block ${blockHeight} timestamp ${block.timestamp}: 50th block and recent!`,
        Math.trunc(Date.now() / 1000)
    )

    const data: string = await new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: 'raw.githubusercontent.com',
                port: 443,
                path: '/TalismanSociety/chaindata/graphql-chaindata-imitator/chaindata.json',
                method: 'GET',
            },
            (res) => {
                let data: string[] = []
                res.on('data', (d) => data.push(d))
                res.on('close', () => resolve(data.join('')))
            }
        )
        req.on('error', reject)
        req.end()
    })

    const json = JSON.parse(data)

    for (const chaindata of json) {
        let chain = await getOrCreate(store, Chain, chaindata.id)
        let relay = chaindata.relay?.id
            ? await getOrCreate(store, Chain, chaindata.relay.id)
            : null

        if (!chain.prefix) chain.prefix = chaindata.prefix
        chain.name = chaindata.name
        if (!chain.token) chain.token = chaindata.token
        if (!chain.decimals) chain.decimals = chaindata.decimals
        chain.account = chaindata.account
        chain.rpcs = chaindata.rpcs
        if (relay !== null && chaindata.paraId) chain.paraId = chaindata.paraId
        chain.relay = relay

        await store.save(chain)
    }

    const updatedChains = await Promise.all(
        (
            await store.find(Chain)
        )
            .sort((a, b) => {
                if (a.id === b.id) return 0
                if (a.id === 'polkadot') return -1
                if (b.id === 'polkadot') return 1
                if (a.id === 'kusama') return -1
                if (b.id === 'kusama') return 1
                return a.id.localeCompare(b.id)
            })
            .map(async (chain, sortIndex): Promise<Chain | null> => {
                chain.sortIndex = sortIndex

                // can't be healthy if chain has no rpcs
                if (!chain.rpcs) return setUnhealthy(chain)

                const maxAttempts = chain.rpcs.length
                for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                    // try to connect to chain
                    let socket: WsProvider | null = null
                    try {
                        socket = new WsProvider(chain.rpcs, 0)

                        const [
                            genesisHash,
                            runtimeVersion,
                            metadataRpc,
                            chainName,
                            { ss58Format, tokenDecimals, tokenSymbol },
                        ] = await new Promise(async (_resolve, _reject) => {
                            let done = false
                            const resolve = (val?: any) => {
                                done = true
                                _resolve(val)
                            }
                            const reject = (val?: any) => {
                                done = true
                                _reject(val)
                            }
                            if (socket === null) return reject('no socket')
                            socket.on('error', () => reject('socket error'))

                            setTimeout(() => {
                                if (!done) reject('timeout')
                            }, 120_000) // 120_000ms = 120s = 2m

                            await socket.connect()

                            await socket.isReady

                            resolve(
                                await Promise.all([
                                    socket.send('chain_getBlockHash', [0]),
                                    socket.send('state_getRuntimeVersion', []),
                                    socket.send('state_getMetadata', []),
                                    socket.send('system_chain', []),
                                    socket.send('system_properties', []),
                                ])
                            )
                        })

                        const { specName, specVersion, implName } =
                            runtimeVersion
                        const registry = getRegistry({
                            specName,
                            specVersion,
                            metadataRpc,
                            chainName,
                        })
                        const metadata = createMetadata(registry, metadataRpc)

                        const existentialDepositCodec =
                            metadata.asLatest.pallets
                                .find((pallet: any) =>
                                    pallet.name.eq('Balances')
                                )
                                ?.constants.find((constant: any) =>
                                    constant.name.eq('ExistentialDeposit')
                                )?.value
                        const existentialDeposit = existentialDepositCodec
                            ? hexToBn(existentialDepositCodec.toHex(), {
                                  isLe: true,
                                  isNegative: false,
                              }).toString()
                            : null

                        chain.chainName = chainName
                        chain.implName = implName
                        chain.specName = specName
                        chain.specVersion = specVersion
                        chain.genesisHash = genesisHash
                        chain.prefix = ss58Format
                        chain.token = Array.isArray(tokenSymbol)
                            ? tokenSymbol[0]
                            : tokenSymbol
                        chain.decimals = Array.isArray(tokenDecimals)
                            ? tokenDecimals[0]
                            : tokenDecimals
                        chain.existentialDeposit = existentialDeposit
                        chain.isHealthy = true

                        return chain
                    } catch (error) {
                        console.debug(error)
                        if (maxAttempts > attempt) {
                            console.log(
                                chain.id,
                                `attempt ${attempt} failed`,
                                error
                            )
                            continue
                        }
                        console.log(
                            chain.id,
                            `all attempts (${maxAttempts}) failed`,
                            error
                        )
                    } finally {
                        socket !== null && socket.disconnect()
                    }
                }

                // ran out of attempts
                return setUnhealthy(chain)
            })
    )

    await store.save(updatedChains)
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

const setUnhealthy = (chain: Chain): Chain | null => {
    chain.isHealthy = false
    return chain
}
