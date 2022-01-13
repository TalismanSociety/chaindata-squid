import * as ss58 from '@subsquid/ss58'
import {
    EventHandlerContext,
    Store,
    SubstrateProcessor,
} from '@subsquid/substrate-processor'
import { Chain } from './model'
import { BalancesTransferEvent } from './types/events'
import https from 'https'

const processor = new SubstrateProcessor('chaindata')

processor.setTypesBundle('kusama')
processor.setBatchSize(500)
processor.setBlockRange({ from: 10_840_000 })

processor.setDataSource({
    archive: 'https://kusama.indexer.gc.subsquid.io/v4/graphql',
    chain: 'wss://kusama-rpc.polkadot.io',
})

processor.addPostHook(async ({ block, store }) => {
    const blockHeight = block.height
    const blockTimestamp = block.timestamp

    // console.debug(`block ${blockHeight} timestamp ${block.timestamp}`)

    // only run every 10 blocks
    if (blockHeight % 10 !== 0) return

    // console.debug(
    //     `block ${blockHeight} timestamp ${block.timestamp}: 10th block!`
    // )

    // ignore if block timestamp is greater than 60 seconds ago
    if (Date.now() - blockTimestamp > 60_000) return

    console.debug(
        `block ${blockHeight} timestamp ${block.timestamp}: 10th block and recent!`
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

    console.debug('received data', data)
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

    console.log('saved data')
})

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
