# kappa-view

> Base for creating kappa-core views over LevelDB for view state and Hypetrie for data.

## Materialized Views

A materialized view does two things:

1. A `map` function, that maps a list of log entries to modifications to a
   view. In this case, a [LevelDB](https://github.com/level/level) database
   for view state and [Hypertrie](https://github.com/hypercore-protocol/hypertrie) 
   for view data.
2. An `api` object, which are functions and variables that the view exposes in
   order to retrieve data from the Hypertrie that `map` writes to.

This module handles *view lifecycle* logic for you: normally a kappa view needs
to manage storing and fetching the state of the indexer ("up to what log
sequence numbers have I processed?"), as well as purging the view's LevelDB
database when the version of the view gets bumped.

## Example

This is a view for a very simple single-value key-value store, that maps log
entries like `{ key: 'foo', value: 'bar' }` to an API that allows `count(prefix)`
queries.


```js
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
```

outputs

```
null 2
```

## API

```js
var makeView = require('kappa-view')
```

### var view = makeView(level, hypertrie, opts, setupFunction)

Create a new view, backed by LevelDB.

Expects a LevelUP or LevelDOWN instance `level`.

Expects a Hypertrie instance `hypertrie`.

`setupFunction` is a function that is given parameters `db` (LevelDB instance)
and `core` (kappa-core instance). It is called exactly once. A kappa view must
be returned, which is an object with the keys

- `map: function (entries, next)`: receives an array of log entries. Once
  you've persisted whatever changes you'd like to `db`, call `next()` to signal
  the view is ready for the next batch of log entries.
- `api: {}`: an object that defines API functions that the view exposes. These
  can have whatever names you want, be sync or async, and return whatever you'd
  like.

## Install

With [npm](https://npmjs.org/) installed, run

```
$ npm install kappa-view-trie
```

## License

ISC
