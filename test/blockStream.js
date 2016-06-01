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
  t.test('simple streaming', function (t) {
    var peer = new MockPeer()
    var bs = new BlockStream(peer, { batchSize: 10, timeout: 500 })
    var res = bs.read()
    t.notOk(res, 'nothing to pull from stream')

    var block = createBlock()

    t.test('incomplete batch', function (t) {
      bs.once('data', function (block) {
        t.ok(block, 'got block')
        t.equal(block.height, 0, 'correct height')
        t.ok(block.header instanceof Block, 'has header of type Block')
        var elapsed = Date.now() - start
        t.ok(Math.abs(elapsed - 500) < 50, 'data emitted on timeout')
        t.end()
      })
      var start = Date.now()
      bs.write(block)
    })

    t.test('full batch', function (t) {
      var expectedHeight = 1
      var onData = function (block) {
        t.ok(block, 'got block')
        t.equal(block.height, expectedHeight++, 'correct height (' + block.height + ')')
        t.ok(block.header instanceof Block, 'has header of type Block')
        var elapsed = Date.now() - start
        t.ok(elapsed < 2000, 'data not emitted on timeout')
        if (block.height === 10) {
          bs.removeListener('data', onData)
          t.end()
        }
      }
      bs.on('data', onData)
      var start = Date.now()

      for (var i = 0; i < 10; i++) {
        block = createBlock(block)
        bs.write(block)
      }
    })

    t.end()
  })

  t.end()
})

function MockPeer () {
  EventEmitter.call(this)
}
inherits(MockPeer, EventEmitter)
MockPeer.prototype.send = function (command, payload) {
  this.emit('send:' + command, payload)
}
MockPeer.prototype.getBlocks = function (hashes, opts, cb) {
  this.emit('getBlocks', hashes, opts, cb)
  setImmediate(function () {
    cb(null, hashes.map(function (hash) {
      return { transactions: [] }
    }))
  })
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
