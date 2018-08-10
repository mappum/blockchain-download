let download = require('blockchain-download')
let { PeerGroup } = require('bitcoin-net')
let Blockchain = require('blockchain-spv')
let params = require('webcoin-bitcoin')

// PeerGroup manages connections with the bitcoin p2p network
let peers = PeerGroup(params.net)

// Blockchain verifies block headers
let chain = Blockchain({
  indexed: true,
  start: {
    height: 0,
    version: 1,
    prevHash: Buffer(32),
    merkleRoot: Buffer.from('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b', 'hex').reverse(),
    timestamp: 1231006505,
    bits: 0x1d00ffff,
    nonce: 2083236893
  }
})

// start connecting to bitcoin nodes
peers.connect()
peers.on('peer', (peer) => {
  console.log(`connected to peer: ${peer.version.userAgent} ${peer.socket.remoteAddress}`)
})
peers.once('peer', async (peer) => {
  console.log('connected to bitcoin network')
  console.log('syncing bitcoin blockchain')
  await download(chain, peers)
  console.log('done syncing bitcoin blockchain')
  peers.close()
})

// emitted when new blocks are added to the chain
chain.on('headers', () => {
  let tip = chain.getByHeight(chain.height())
  let hash = Blockchain.getHash(tip).reverse()
  console.log(`synced to height ${chain.height()} (hash ${hash.toString('hex')})`)
})
chain.on('reorg', (e) => {
  console.log('reorg', e)
})
