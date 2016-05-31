var EventEmitter = require('events')
var inherits = require('util').inherits
var test = require('tape')
var BlockStream = require('../').BlockStream

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

function MockPeer () {
  EventEmitter.call(this)
}
inherits(MockPeer, EventEmitter)

MockPeer.prototype.send = function (command, payload) {
  this.emit(command, payload)
}
