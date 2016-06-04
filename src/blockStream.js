var Transform = require('stream').Transform
var util = require('util')
var Inventory = require('bitcoin-inventory')
var merkleProof = require('bitcoin-merkle-proof')
var debug = require('debug')('blockchain-download:blockstream')
var wrapEvents = require('event-cleanup')
var assign = require('object-assign')

var BlockStream = module.exports = function (peers, opts) {
  if (!(this instanceof BlockStream)) return new BlockStream(peers, opts)
  if (!peers) throw new Error('"peers" argument is required for BlockStream')
  Transform.call(this, { objectMode: true })

  debug(`created BlockStream: ${JSON.stringify(opts, null, '  ')}`)

  opts = opts || {}
  this.peers = peers
  this.batchSize = opts.batchSize || 64
  this.filtered = opts.filtered
  this.timeout = opts.timeout || 2 * 1000
  this.inventory = opts.inventory
  if (!this.inventory) {
    this.inventory = Inventory(peers, { ttl: 10 * 1000 })
    this.createdInventory = true
  }

  this.batch = []
  this.ended = false

  this.batchTimeout = null
}
util.inherits(BlockStream, Transform)

BlockStream.prototype._error = function (err) {
  this.emit('error', err)
}

BlockStream.prototype._transform = function (block, enc, cb) {
  if (this.ended) return

  // buffer block hashes until we have `batchSize`, then make a `getdata`
  // request with all of them once the batch fills up, or if we don't receive
  // any headers for a certain amount of time (`timeout` option)
  this.batch.push(block)
  if (this.batchTimeout) clearTimeout(this.batchTimeout)
  if (this.batch.length >= this.batchSize) {
    this._sendBatch(cb)
  } else {
    this.batchTimeout = setTimeout(() => {
      this._sendBatch((err) => {
        if (err) this._error(err)
      })
    }, this.timeout)
    cb(null)
  }
}

BlockStream.prototype._sendBatch = function (cb) {
  if (this.ended) return
  var batch = this.batch
  this.batch = []
  var hashes = batch.map((block) => block.header.getHash())
  this.peers.getBlocks(hashes, { filtered: this.filtered }, (err, blocks, peer) => {
    if (err) return cb(err)
    var onBlock = this.filtered ? this._onMerkleBlock : this._onBlock
    blocks.forEach((block, i) => {
      block = assign({}, batch[i], block)
      onBlock.call(this, block, peer)
    })
    cb(null)
  })
}

BlockStream.prototype._onBlock = function (block) {
  if (this.ended) return
  this.push(block)
}

BlockStream.prototype._onMerkleBlock = function (block, peer) {
  if (this.ended) return
  var self = this

  var txids = merkleProof.verify({
    flags: block.flags,
    hashes: block.hashes,
    numTransactions: block.numTransactions,
    merkleRoot: block.header.merkleRoot
  })
  if (txids.length === 0) return done([])

  var transactions = []
  var remaining = txids.length

  var timeout = peer.latency * 6 + 2000
  var txTimeout = setTimeout(() => {
    this.peers.getTransactions(txids, (err, transactions) => {
      if (err) return this.emit('error', err)
      done(transactions)
    })
  }, timeout)

  var events = wrapEvents(this.inventory)
  txids.forEach((txid, i) => {
    var tx = this.inventory.get(txid)
    if (tx) {
      maybeDone(tx, i)
      return
    }
    var hash = txid.toString('base64')
    events.once(`tx:${hash}`, (tx) => maybeDone(tx, i))
  })

  function maybeDone (tx, i) {
    transactions[i] = tx
    remaining--
    if (remaining === 0) done(transactions)
  }

  function done (transactions) {
    clearTimeout(txTimeout)
    if (events) events.removeAll()
    block.transactions = transactions
    self.push(block)
  }
}

BlockStream.prototype.end = function () {
  this.ended = true
  this.push(null)
  if (this.createdInventory) this.inventory.close()
}
