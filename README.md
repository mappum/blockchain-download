# blockchain-download

[![npm version](https://img.shields.io/npm/v/blockchain-download.svg)](https://www.npmjs.com/package/blockchain-download)
[![Build Status](https://travis-ci.org/mappum/blockchain-download.svg?branch=master)](https://travis-ci.org/mappum/blockchain-download)
[![Dependency Status](https://david-dm.org/mappum/blockchain-download.svg)](https://david-dm.org/mappum/blockchain-download)

**Download blockchain data from peers**

## Usage

`npm install blockchain-download`

`blockchain-download` provides streams which simplify downloading blockchain data (headers, full blocks, filtered blocks, or transactions) from network peers. Peers are provided by the [`bitcoin-net`](https://github.com/mappum/bitcoin-net) module.

----
### `HeaderStream`

`HeaderStream` is  used for syncing blockchain state with a module like [`blockchain-spv`](https://github.com/mappum/blockchain-spv). It will download existing blocks from peers when doing an initial sync, and also outputs newly mined blocks relayed by the network.

Example sync:
```js
var PeerGroup = require('bitcoin-net').PeerGroup
var HeaderStream = require('blockchain-download').HeaderStream
var Blockchain = require('blockchain-spv')

// connect to P2P network
var peers = new PeerGroup(some_params)
peers.connect()

// create Blockchain and HeaderStream
var chain = new Blockchain(some_params, some_db)
var headers = new HeaderStream(peers)

chain.createLocatorStream() // locators tell us which headers to fetch
  .pipe(headers) // pipe locators into HeaderStream
  .pipe(chain.createWriteStream()) // pipe headers into Blockchain
```
This example will download block headers and add them to our `Blockchain`, which will verify them and save them to its database.

#### `new HeaderStream(peers, [opts])`

`HeaderStream` is a `Transform` stream. Its **input** should be "locators", which are arrays of block hashes (as `Buffer`s), descending in height, which specify which blocks to download. For more info about locators, see the [bitcoin wiki](https://en.bitcoin.it/wiki/Protocol_documentation#getblocks). Its **output** will be Arrays of [BitcoinJS](https://github.com/bitcoinjs/bitcoinjs-lib) `Block` objects.

`peers` should be a [`bitcoin-net`](https://github.com/mappum/bitcoin-net) `PeerGroup` or `Peer` instance that the headers should be downloaded from.

`opts` may contain:
- `timeout` *Number* (default: *dynamic, based on peer latency*) - the amount of time to wait (in ms) before timing out when requesting headers from a peer
- `stop` *Buffer* (default: `null`) - If specified, the `HeaderStream` will end once a block header is reached with this hash
- `endOnTip` *Boolean* (default: `false` in browsers, `false` in Node) - If `true`, the stream will end once it syncs all the way to the most recent block (instead of listening for newly mined blocks)
