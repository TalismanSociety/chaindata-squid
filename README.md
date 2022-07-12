# chaindata-squid

<img src="TalisSquid.svg" alt="Talisman" width="15%" align="right" />

[![squid-link](https://img.shields.io/website?label=squid&style=flat-square&up_message=online&down_message=offline&url=https%3A%2F%2Fapp.gc.subsquid.io%2Fbeta%2Fchaindata%2Fnext%2Fgraphql)](https://app.gc.subsquid.io/beta/chaindata/next/graphql)
[![discord-link](https://img.shields.io/discord/858891448271634473?logo=discord&logoColor=white&style=flat-square)](https://discord.gg/rQgTD9SGtU)

**A [subsquid](https://subsquid.io) indexer for the [chaindata](https://github.com/talismansociety/chaindata) project.**  
Currently this is using squid v5, in the future it should be migrated to firesquid.

## Handy resources

- [Subsquid docs](https://docs.subsquid.io/)
- [Subsquid project template](https://github.com/subsquid/squid-template)

## How to set up a development environment

```bash
# Install project dependencies
npm i

# Start postgres database
docker-compose up -d

# Apply database migrations from db/migrations
npm run db:migrate

# Run the processor
npm run processor:dev-start

# In another terminal window, run the query node
npm run query-node:start
```

