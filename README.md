# chaindata-squid

<img src="assets/TalisSquid.svg" alt="Talisman" width="15%" align="right" />

[![squid-link](https://img.shields.io/website?label=squid&style=flat-square&up_message=online&down_message=offline&url=https%3A%2F%2Fapp.gc.subsquid.io%2Fbeta%2Fchaindata%2Fnext%2Fgraphql)](https://app.gc.subsquid.io/beta/chaindata/next/graphql)
[![discord-link](https://img.shields.io/discord/858891448271634473?logo=discord&logoColor=white&style=flat-square)](https://discord.gg/rQgTD9SGtU)

**A [subsquid](https://subsquid.io) indexer for the [chaindata](https://github.com/talismansociety/chaindata) project.**  
Now running on [🔥🦑](https://docs.subsquid.io/new-in-fire-squid/).

## Handy resources

- [Subsquid docs](https://docs.subsquid.io/)
- [Subsquid project template](https://github.com/subsquid/squid-template)

## How to set up a development environment

```bash
# Install project dependencies
npm i

# Start postgres database
make up

# Run the processor (in dev mode)
make dev

# In another terminal window, run the query node
make serve
```
