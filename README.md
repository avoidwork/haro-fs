# haro-fs

[![Join the chat at https://gitter.im/avoidwork/haro-fs](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/avoidwork/haro-fs?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

[![build status](https://secure.travis-ci.org/avoidwork/haro-fs.svg)](http://travis-ci.org/avoidwork/haro-fs)

[Harō](http://haro.rocks) is a modern immutable DataStore built with ES6 features, which can be wired to an API for a complete feedback loop.
It is un-opinionated, and offers a plug'n'play solution to modeling, searching, & managing data on the client, or server
(in RAM). It is a [partially persistent data structure](https://en.wikipedia.org/wiki/Persistent_data_structure), by maintaining version sets of records in `versions` ([MVCC](https://en.wikipedia.org/wiki/Multiversion_concurrency_control)).

***haro-fs*** is a persistent storage adapter, providing 'auto saving' behavior, as well as the ability to `save()` & `load()` the entire DataStore.

If `store.key` is not set, the fail over "id" field will be `id`.

### How to use
Require the adapter & register it with `haro.register(key, fn)`. The key must match the `store.adapters` key.

If `iv` is specified, the file(s) on disk will contain ciphers, to be deciphered when loaded back into `haro`.

```javascript
var haro = require('haro'),
    store;

// Configure a store to utilize the adapter
store = haro(null, {
  adapters: {
    fs: {
      directory: "/path/to/records/"
      iv: ""
    }
  }
});

// Register the adapter
store.register('mongo', require('haro-fs'));

// Ready to `load()`, `batch()` or `set()`!
```

### Encryption
`haro-fs` supports writing & reading ciphers. Supported 

## License
Copyright (c) 2015 Jason Mulligan
Licensed under the BSD-3 license
