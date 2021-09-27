var Writable = require('readable-stream').Writable
var pump = require('pump')
var sub = require('subleveldown')

module.exports = createIndex

function createIndex (stateDb, dataDb, opts, makeFn) {
  if (typeof opts === 'function' && !makeFn) {
    makeFn = opts
    opts = {}
  }
  // var stateDb = sub(ldb, 's')
  // var dataDb = sub(ldb, 'd', opts)

  var basic = {
    maxBatch: 100 || opts.maxBatch,

    storeState: function (state, cb) {
      state = state.toString('base64')
      stateDb.put('state', state, cb)
    },

    fetchState: function (cb) {
      stateDb.get('state', function (err, state) {
        if (err && err.notFound) cb()
        else if (err) cb(err)
        else cb(null, Buffer.from(state, 'base64'))
      })
    },

    clearIndex: function (cb) {
      var batch = []
      var maxSize = 5000
      pump(dataDb.createHistoryStream(), new Writable({
        objectMode: true,
        write: function ({key}, enc, next) {
          // console.log("kappa-view-trie.key", key)
          batch.push({ type: 'del', key })
          if (batch.length >= maxSize) {
            // console.log("kappa-view-trie.batch.length", batch.length)
            dataDb.batch(batch, (err) => {
              if (err) return console.log('Ooops!', err)
              next()
            })
          } else next()
        },
        final: function (next) {
          // console.log("final.batch", batch)
          if (batch.length > 0) dataDb.batch(batch, (err) => {
            if (err) return console.log('Ooops!', err)
            next()
          })
          else next()
        }
      }), ondone)
      function ondone (err) {
        if (err) cb(err)
        else cb()
      }
    }
  }

  return Object.assign({}, basic, makeFn(dataDb))
}
