import https from 'https'
import {
    EventHandlerContext,
    Store,
    SubstrateProcessor,
} from '@subsquid/substrate-processor'
import { WsProvider } from '@polkadot/api'
import { Chain } from './model'
import { BalancesTransferEvent } from './types/events'

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

    // console.debug('received data', data)
    const json = JSON.parse(data)

    for (const chaindata of json) {
        let chain = await getOrCreate(store, Chain, chaindata.id)
        let relay = chaindata.relay?.id
            ? await getOrCreate(store, Chain, chaindata.relay.id)
            : null

        if (chaindata.relay?.paraId) chain.paraId = chaindata.relay?.paraId
        // chain.genesisHash =
        chain.prefix = chaindata.prefix
        chain.name = chaindata.name
        chain.token = chaindata.token
        chain.decimals = chaindata.decimals
        chain.existentialDeposit = chaindata.existentialDeposit
        chain.account = chaindata.account
        chain.rpcs = chaindata.rpcs
        chain.relay = relay

        await store.save(chain)
    }

    console.debug('updated chaindata')

    const setUnhealthy = (chain: Chain): Chain | null => {
        if (!chain.isHealthy) return null // no need to update

        chain.isHealthy = false
        return chain
    }

    const allChains = await store.find(Chain)
    const updatedChains = (
        await Promise.all(
            allChains.map(async (chain): Promise<Chain | null> => {
                // can't be healthy if chain has no rpcs
                if (!chain.rpcs) return setUnhealthy(chain)

                const maxAttempts = chain.rpcs.length
                for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                    // try to connect to chain
                    let socket: WsProvider | null = null
                    try {
                        socket = new WsProvider(chain.rpcs, 0)

                        const data = await new Promise(
                            async (_resolve, _reject) => {
                                let done = false
                                const resolve = (val?: any) => {
                                    done = true
                                    _resolve(val)
                                }
                                const reject = (val?: any) => {
                                    done = true
                                    _reject(val)
                                }
                                if (socket === null) return reject()
                                socket.on('error', reject)

                                setTimeout(() => {
                                    if (!done) reject('timeout')
                                }, 120_000) // 120_000ms = 120s = 2m

                                console.log(chain.id, 'connecting')

                                await socket.connect()

                                console.log(chain.id, 'connected')

                                await socket.isReady

                                const [runtimeVersion] = await Promise.all([
                                    socket.send('state_getRuntimeVersion', []),
                                ])

                                console.log(
                                    chain.id,
                                    'runtimeVersion',
                                    runtimeVersion.specName,
                                    runtimeVersion.specVersion
                                )

                                resolve([])
                            }
                        )

                        chain.isHealthy = true
                        return chain
                    } catch (error) {
                        if (maxAttempts > attempt)
                            console.log(chain.id, `attempt ${attempt} failed`)
                        continue
                        // return setUnhealthy(chain)
                    } finally {
                        socket !== null && socket.disconnect()
                    }
                }

                // ran out of attempts
                return setUnhealthy(chain)

                // // if we made it this far, chain is healthy!
                // chain.isHealthy = true
                // return chain
            })
        )
    ).filter((chain): chain is Chain => chain !== null)

    if (updatedChains.length > 0) await store.save(updatedChains)
})

// indexer breaks if we don't subscribe to at least one type of event in addition to the postBlock hook
processor.addEventHandler('balances.Transfer', async () => {})

processor.run()

interface TransferEvent {
    from: Uint8Array
    to: Uint8Array
    amount: bigint
}

function getTransferEvent(ctx: EventHandlerContext): TransferEvent {
    let event = new BalancesTransferEvent(ctx)
    if (event.isV1020) {
        let [from, to, amount] = event.asV1020
        return { from, to, amount }
    } else if (event.isV1050) {
        let [from, to, amount] = event.asV1050
        return { from, to, amount }
    } else {
        return event.asLatest
    }
}

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
