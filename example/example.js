let download = require('blockchain-download')
let { PeerGroup } = require('bitcoin-net')
let Blockchain = require('blockchain-spv')
let params = require('webcoin-bitcoin')

// PeerGroup manages connections with the bitcoin p2p network
let peers = PeerGroup(params.net)

// Blockchain verifies block headers
let chain = Blockchain({
  indexed: true,
  start: params.blockchain.genesisHeader
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
