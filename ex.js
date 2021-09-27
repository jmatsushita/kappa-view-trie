var kappa = require('kappa-core')
var View = require('.')
var ram = require('random-access-memory')
var memdb = require('memdb')
const hypertrie = require('hypertrie')
const trie = hypertrie(ram, {valueEncoding: 'json'})

var core = kappa(ram, { valueEncoding: 'json' })
var state = memdb()

var view = View(state, trie, function (data) {
  return {
    map: function (entries, next) {
      const batch = entries.map(({value: {key, value}}) => {
        return { 
          type: 'put',
          key,
          value
        }
      })
      data.batch(batch, (err) => {
        if (err) return next(err)
        return next()
      })
    },
    
    api: {
      count: function (core, prefix, cb) {
        core.ready(function () {  // wait for all views to catch up
          data.list(prefix, (err, ret) => {
            if (err) return cb(err);
            const count = ret ? ret.length : 0;
            cb(null, count);
          })
        })
      }
    }
  };
})

core.use('mapper', view)

core.writer('default', function (err, feed) {
  feed.append({key: 'foo', value: 'bar'})
  feed.append({key: 'bax', value: 'baz'})
  feed.append({key: 'foo/bar', value: 'nix'})
  core.ready('mapper', function () {
    core.api.mapper.count('foo', console.log)
  })
})
