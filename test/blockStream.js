var pseudoRandomBytes = require('crypto').pseudoRandomBytes
var EventEmitter = require('events')
var inherits = require('util').inherits
var Block = require('bitcoinjs-lib').Block
var u = require('bitcoin-util')
var test = require('tape')
var BlockStream = require('../').BlockStream
require('setimmediate')

test('create BlockStream', function (t) {
  t.test('normal constructor', function (t) {
    var bs = new BlockStream(new MockPeer())
    t.ok(bs instanceof BlockStream, 'got BlockStream')
    t.end()
  })
  t.test('constructor without "new"', function (t) {
    var bs = BlockStream(new MockPeer())
    t.ok(bs instanceof BlockStream, 'got BlockStream')
    t.end()
  })
  t.test('without "peers"', function (t) {
    try {
      var bs = new BlockStream()
      t.notOk(bs, 'should have thrown')
    } catch (err) {
      t.ok(err, 'error thrown')
      t.equal(err.message, '"peers" argument is required for BlockStream', 'correct error message')
      t.end()
    }
  })
})

test('mock tests', function (t) {
  t.test('simple BlockStream', function (t) {
    var peer = new MockPeer()
    var bs = new BlockStream(peer, { batchSize: 10, timeout: 500 })
    var res = bs.read()
    t.notOk(res, 'nothing to pull from stream')

    var _block = createBlock()
    function block () {
      return _block = createBlock(_block)
    }

    t.test('incomplete batch', function (t) {
      bs.once('data', function (block) {
        t.ok(block, 'got block')
        t.equal(block.height, 1, 'correct height')
        t.ok(block.header instanceof Block, 'has header of type Block')
        t.ok(Array.isArray(block.transactions), 'has transactions array')
        t.equal(block.transactions.length, 0, 'transactions array is empty')
        var elapsed = Date.now() - start
        t.ok(Math.abs(elapsed - 500) < 50, 'data emitted on timeout')
        t.end()
      })
      var start = Date.now()
      bs.write(block())
    })

    t.test('full batch', function (t) {
      var expectedHeight = 2
      var onData = function (block) {
        t.ok(block, 'got block')
        t.equal(block.height, expectedHeight++, 'correct height (' + block.height + ')')
        t.ok(block.header instanceof Block, 'has header of type Block')
        t.ok(Array.isArray(block.transactions), 'has transactions array')
        t.equal(block.transactions.length, 0, 'transactions array is empty')
        var elapsed = Date.now() - start
        t.ok(elapsed < 2000, 'data not emitted on timeout')
        if (block.height === 11) {
          bs.removeListener('data', onData)
          t.end()
        }
      }
      bs.on('data', onData)
      var start = Date.now()
      for (var i = 0; i < 10; i++) {
        bs.write(block())
      }
    })

    t.test('block "add" property', function (t) {
      bs.once('data', function (block) {
        t.equal(block.add, true, 'correct "add" property')
        t.end()
      })
      var b = block()
      b.add = true
      bs.write(b)
    })

    t.test('blocks sent out of order', function (t) {
      var expectedHeight = 13
      bs.once('data', function (block) {
        t.equal(block.height, expectedHeight++, 'correct height')
        if (block.height === 15) t.end()
      })

      setImmediate(function () {
        peer.delay = 200
        bs.write(block())
      })
      setImmediate(function () {
        peer.delay = 100
        bs.write(block())
      })
      setImmediate(function () {
        peer.delay = 150
        bs.write(block())
      })
      setImmediate(function () {
        peer.delay = 50
        bs.write(block())
      })
    })

    t.end()
  })
  t.test('filtered BlockStream', function (t) {
    var peer = new MockPeer()
    var bs = new BlockStream(peer, { batchSize: 10, timeout: 500, filtered: true })
    var res = bs.read()
    t.notOk(res, 'nothing to pull from stream')

    var block
    t.test('merkleblock with no transactions', function (t) {
      bs.once('data', function (block) {
        t.ok(block, 'got block')
        t.equal(block.height, 0, 'correct height')
        t.ok(block.header instanceof Block, 'has header of type Block')
        t.ok(Array.isArray(block.transactions), 'has transactions array')
        t.equal(block.transactions.length, 0, 'transactions array is empty')
        var elapsed = Date.now() - start
        t.ok(Math.abs(elapsed - 500) < 50, 'data emitted on timeout')
        t.end()
      })
      var start = Date.now()
      block = createBlock()
      block.flags = [ 0 ]
      block.hashes = [ u.nullHash ]
      block.numTransactions = 0
      bs.write(block)
    })

    t.test('merkleblock followed by "tx" message', function (t) {
      var hash = Buffer(32).fill(0xff)
      var tx = createTx(hash)
      bs.once('data', function (block) {
        t.ok(block, 'got block')
        t.equal(block.height, 1, 'correct height')
        t.ok(block.header instanceof Block, 'has header of type Block')
        t.ok(Array.isArray(block.transactions), 'has transactions array')
        t.equal(block.transactions.length, 1, 'transactions array has 1 element')
        t.equal(block.transactions[0], tx, 'correct transaction')
        var elapsed = Date.now() - start
        t.ok(Math.abs(elapsed - 500) < 50, 'data emitted on timeout')
        t.end()
      })
      var start = Date.now()
      block = createBlock()
      block.height = 1
      block.header.merkleRoot = Buffer('4fa4a869878bd4837e6192377293a0cc14f192b88711635ca3df0447dc1bea76', 'hex')
      block.flags = [ 5 ]
      block.hashes = [ Buffer(32).fill(0), hash ]
      block.numTransactions = 2
      bs.write(block)
      setTimeout(function () {
        peer.emit('tx', tx)
      }, 500)
    })

    t.test('merkleblock after "tx" message', function (t) {
      var hash = Buffer(32).fill(0xee)
      var tx = createTx(hash)
      bs.once('data', function (block) {
        t.ok(block, 'got block')
        t.equal(block.height, 2, 'correct height')
        t.ok(block.header instanceof Block, 'has header of type Block')
        t.ok(Array.isArray(block.transactions), 'has transactions array')
        t.equal(block.transactions.length, 1, 'transactions array has 1 element')
        t.equal(block.transactions[0], tx, 'correct transaction')
        var elapsed = Date.now() - start
        t.ok(Math.abs(elapsed - 500) < 50, 'data emitted on timeout')
        t.end()
      })
      var start = Date.now()
      block = createBlock()
      block.height = 2
      block.header.merkleRoot = Buffer('827e6e137f5dca3f7ea0cd17215b3f21bec92045a475eae1c43874ea8435090e', 'hex')
      block.flags = [ 5 ]
      block.hashes = [ Buffer(32).fill(0), hash ]
      block.numTransactions = 2
      peer.emit('tx', tx)
      bs.write(block)
    })

    t.test('merkleblock with tx not sent', function (t) {
      var hash = Buffer(32).fill(0xdd)
      var tx = createTx(hash)
      bs.once('data', function (block) {
        t.ok(block, 'got block')
        t.equal(block.height, 3, 'correct height')
        t.ok(block.header instanceof Block, 'has header of type Block')
        t.ok(Array.isArray(block.transactions), 'has transactions array')
        t.equal(block.transactions.length, 1, 'transactions array has 1 element')
        t.equal(block.transactions[0], tx, 'correct transaction')
        t.end()
      })
      block = createBlock()
      block.height = 3
      block.header.merkleRoot = Buffer('b97ec2658b3a8a77d56ea4c0996764a205b086afdc7dd412e1e79930b98578dc', 'hex')
      block.flags = [ 5 ]
      block.hashes = [ Buffer(32).fill(0), hash ]
      block.numTransactions = 2
      bs.write(block)
      var start = Date.now()
      peer.once('getTransactions', function (hashes, cb) {
        t.pass('"getTransactions" called')
        t.equal(hashes.length, 1, 'correct number of hashes')
        t.equal(hashes[0].toString('hex'), hash.toString('hex'), 'correct hash')
        var elapsed = Date.now() - start
        t.ok(elapsed > 1000, '"getTransactions" called after delay')
        cb(null, [ tx ])
      })
    })

    t.end()
  })

  t.end()
})

function MockPeer () {
  EventEmitter.call(this)
  this.latency = 0
}
inherits(MockPeer, EventEmitter)
MockPeer.prototype.send = function (command, payload) {
  this.emit('send:' + command, payload)
}
MockPeer.prototype.getBlocks = function (hashes, opts, cb) {
  var self = this
  setImmediate(function () {
    cb(null, hashes.map(function (hash) {
      return { transactions: [] }
    }), self)
  })
}
MockPeer.prototype.getTransactions = function (hashes, cb) {
  this.emit('getTransactions', hashes, cb)
}

function createBlock (prev) {
  var header = new Block()
  header.version = 2
  header.merkleRoot = u.nullHash
  header.timestamp = Math.floor(Date.now() / 1000)
  header.bits = 0xff000000
  header.nonce = Math.floor(Math.random() * 0xffffffff)
  header.prevHash = prev ? prev.header.getHash() : u.nullHash
  return {
    height: prev ? prev.height + 1 : 0,
    header: header
  }
}

function createTx (hash) {
  hash = hash || pseudoRandomBytes(32)
  return { getHash: function () { return hash } }
}
