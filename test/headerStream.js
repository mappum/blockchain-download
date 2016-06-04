var test = require('tape')
var HeaderStream = require('..').HeaderStream
// var createBlock = require('./common.js').createBlock
// var createTx = require('./common.js').createTx
var MockPeer = require('./common.js').MockPeer

test('create HeaderStream', function (t) {
  t.test('normal constructor', function (t) {
    var hs = new HeaderStream(new MockPeer())
    t.ok(hs instanceof HeaderStream, 'got HeaderStream')
    t.end()
  })
  t.test('constructor without "new"', function (t) {
    var hs = HeaderStream(new MockPeer())
    t.ok(hs instanceof HeaderStream, 'got HeaderStream')
    t.end()
  })
  t.test('constructor without peers', function (t) {
    try {
      var hs = new HeaderStream()
      t.notOk(hs, 'should have thrown')
    } catch (err) {
      t.ok(err, 'error thrown')
      t.equal(err.message, '"peers" argument is required for HeaderStream', 'correct error message')
      t.end()
    }
  })
  t.end()
})
