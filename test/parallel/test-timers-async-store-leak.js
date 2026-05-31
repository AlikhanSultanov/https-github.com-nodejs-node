// Flags: --expose-internals --no-async-context-frame
'use strict';

const common = require('../common');
const { AsyncLocalStorage } = require('async_hooks');
const assert = require('assert');
const {
  symbols: {
    async_local_storage_context_symbol,
  },
} = require('internal/async_hooks');

function getStore(resource, asyncLocalStorage) {
  return resource[async_local_storage_context_symbol]?.[asyncLocalStorage.kResourceStore];
}

function assertNoStore(resource) {
  assert.strictEqual(resource[async_local_storage_context_symbol], undefined);
}

// Test that setTimeout does not retain a reference to the async store after
// firing. The callback and arguments must stay on the Timeout object so that
// refresh() can reactivate the timer.
{
  const asyncLocalStorage = new AsyncLocalStorage();
  const store = {};
  const arg = {};
  asyncLocalStorage.run(store, common.mustCall(() => {
    const timeout = setTimeout(common.mustCall((received) => {
      assert.strictEqual(received, arg);
      setImmediate(common.mustCall(() => {
        assertNoStore(timeout);
      }));
    }), 1, arg);
    assert.strictEqual(getStore(timeout, asyncLocalStorage), store);
  }));
}

// Test that clearTimeout cleans up the store, callback, and arguments before
// firing.
{
  const asyncLocalStorage = new AsyncLocalStorage();
  const store = {};
  const arg = {};
  asyncLocalStorage.run(store, common.mustCall(() => {
    const timeout = setTimeout(common.mustNotCall(), common.platformTimeout(1000), arg);
    assert.strictEqual(getStore(timeout, asyncLocalStorage), store);
    clearTimeout(timeout);
    assertNoStore(timeout);
    assert.strictEqual(timeout._onTimeout, undefined);
    assert.strictEqual(timeout._timerArgs, undefined);
  }));
}

// Test that setInterval does not retain a reference to the async store,
// callback, or arguments after it is cleared.
{
  const asyncLocalStorage = new AsyncLocalStorage();
  const store = {};
  const arg = {};
  asyncLocalStorage.run(store, common.mustCall(() => {
    const interval = setInterval(common.mustCall((received) => {
      assert.strictEqual(received, arg);
      clearInterval(interval);
      assert.strictEqual(asyncLocalStorage.getStore(), store);
      setImmediate(common.mustCall(() => {
        assertNoStore(interval);
        assert.strictEqual(interval._onTimeout, undefined);
        assert.strictEqual(interval._timerArgs, undefined);
      }));
    }), 1, arg);
    assert.strictEqual(getStore(interval, asyncLocalStorage), store);
  }));
}

// Test that setImmediate does not retain a reference to the async store,
// callback, or arguments after firing.
{
  const asyncLocalStorage = new AsyncLocalStorage();
  const store = {};
  const arg = {};
  asyncLocalStorage.run(store, common.mustCall(() => {
    const immediate = setImmediate(common.mustCall((received) => {
      assert.strictEqual(received, arg);
      setImmediate(common.mustCall(() => {
        assertNoStore(immediate);
        assert.strictEqual(immediate._onImmediate, undefined);
        assert.strictEqual(immediate._argv, undefined);
      }));
    }), arg);
    assert.strictEqual(getStore(immediate, asyncLocalStorage), store);
  }));
}

// Test that clearImmediate cleans up the store, callback, and arguments before
// firing.
{
  const asyncLocalStorage = new AsyncLocalStorage();
  const store = {};
  const arg = {};
  asyncLocalStorage.run(store, common.mustCall(() => {
    const immediate = setImmediate(common.mustNotCall(), arg);
    assert.strictEqual(getStore(immediate, asyncLocalStorage), store);
    clearImmediate(immediate);
    assertNoStore(immediate);
    assert.strictEqual(immediate._onImmediate, undefined);
    assert.strictEqual(immediate._argv, undefined);
  }));
}
