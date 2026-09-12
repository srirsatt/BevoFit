const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/facilityCache.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const gym = (id = 'greg') => ({ id, name: id, lat: 30.28, lng: -97.73, facility_hours: { mon: '6:00 AM - 10:00 PM' } });
const saved = (data, savedAt = 100000000, version = 1) => JSON.stringify({ version, savedAt, data });
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function setup(raw = null) {
  const state = { raw, now: 100000000, requests: 0, reads: 0, writes: 0, readFailure: false, writeFailure: false,
    fetch: async () => ({ data: [gym()], error: null }), signals: [], timers: new Map() };
  const dependencies = {
    '@react-native-async-storage/async-storage': {
      getItem: async () => { state.reads++; if (state.readFailure) throw Error('disk'); return state.raw; },
      setItem: async (_, value) => { state.writes++; if (state.writeFailure) throw Error('disk'); state.raw = value; },
    },
    './supabase': { supabase: { from(table) {
      assert.equal(table, 'facilities');
      return { select() { return { abortSignal(signal) { state.signals.push(signal); state.requests++; return state.fetch(); } }; } };
    } } },
  };
  const exports = {};
  vm.runInNewContext(source, { exports, require: name => dependencies[name], process: { env: {} },
    Date: { now: () => state.now }, AbortController,
    setTimeout: fn => { const id = Symbol(); state.timers.set(id, fn); return id; },
    clearTimeout: id => state.timers.delete(id),
  });
  return { state, cache: exports.facilityCache, markers: exports.facilityMarkers };
}

test('saved data appears before the refresh finishes and fresh results replace it', async () => {
  const { state, cache } = setup(saved([gym('saved')]));
  const gate = deferred(); state.fetch = () => gate.promise;
  const seen = []; const unsubscribe = cache.subscribe(() => seen.push(cache.getSnapshot()));
  const work = cache.refresh(); await flush();
  assert.equal(cache.getSnapshot().data[0].id, 'saved');
  assert.equal(cache.getSnapshot().refreshing, true);
  gate.resolve({ data: [gym('fresh')], error: null }); await work;
  assert.equal(cache.getSnapshot().data[0].id, 'fresh');
  assert.equal(JSON.parse(state.raw).data[0].id, 'fresh');
  assert.equal(cache.getSnapshot().refreshing, false);
  unsubscribe(); const count = seen.length;
  await cache.refresh(true); assert.equal(seen.length, count);
});

test('Home, Map, and Calendar share one simultaneous request and five-minute memory freshness', async () => {
  const { state, cache } = setup(); const gate = deferred(); state.fetch = () => gate.promise;
  const jobs = [cache.refresh(), cache.refresh(), cache.refresh(true)]; await flush();
  assert.equal(state.reads, 1); assert.equal(state.requests, 1);
  gate.resolve({ data: [gym()], error: null }); await Promise.all(jobs);
  await cache.refresh(); assert.equal(state.requests, 1);
  state.fetch = async () => ({ data: [gym()], error: null });
  await cache.refresh(true); assert.equal(state.requests, 2);
  state.now += 5 * 60000; await cache.refresh(); assert.equal(state.requests, 3);
});

test('a new app session restores persisted data and still checks the server', async () => {
  const first = setup(); await first.cache.refresh();
  const second = setup(first.state.raw); const gate = deferred(); second.state.fetch = () => gate.promise;
  const work = second.cache.refresh(); await flush();
  assert.equal(second.cache.getSnapshot().data[0].id, 'greg');
  assert.equal(second.state.requests, 1);
  gate.resolve({ data: [gym('rec')], error: null }); await work;
  assert.equal(second.cache.getSnapshot().data[0].id, 'rec');
});

test('offline refresh keeps saved data and recovery replaces it', async () => {
  const { state, cache } = setup(saved([gym('saved')]));
  state.fetch = async () => ({ data: null, error: { message: 'offline' } });
  await cache.refresh(); assert.equal(cache.getSnapshot().data[0].id, 'saved'); assert.ok(cache.getSnapshot().error);
  assert.equal(state.writes, 0);
  state.fetch = async () => ({ data: [gym('fresh')], error: null });
  await cache.refresh(true); assert.equal(cache.getSnapshot().data[0].id, 'fresh'); assert.equal(cache.getSnapshot().error, null);
});

test('corrupt, expired, future-dated, and incompatible saved data are discarded', async () => {
  for (const raw of ['bad json', 'null', saved({}, 100000000), saved([gym()], 1), saved([gym()], 200000000), saved([gym()], 100000000, 2), saved([{ ...gym(), facility_activities: [null] }])]) {
    const { state, cache } = setup(raw);
    state.fetch = async () => ({ data: null, error: { message: 'offline' } });
    await cache.refresh(); assert.equal(cache.getSnapshot().data, null); assert.ok(cache.getSnapshot().error);
  }
});

test('storage failures do not block successful network data', async () => {
  const { state, cache } = setup(); state.readFailure = true; state.writeFailure = true;
  await cache.refresh(); assert.equal(cache.getSnapshot().data[0].id, 'greg'); assert.equal(cache.getSnapshot().error, null);
});

test('empty fresh results remove deleted gyms, including from the persisted cache', async () => {
  const { state, cache } = setup(saved([gym()])); state.fetch = async () => ({ data: [], error: null });
  await cache.refresh(); assert.equal(cache.getSnapshot().data.length, 0); assert.equal(JSON.parse(state.raw).data.length, 0);
});

test('invalid network results cannot replace valid cached data', async () => {
  const { state, cache } = setup(saved([gym()])); state.fetch = async () => ({ data: [{ id: 'broken' }], error: null });
  await cache.refresh(); assert.equal(cache.getSnapshot().data[0].id, 'greg'); assert.ok(cache.getSnapshot().error);
  assert.equal(state.writes, 0);
});

test('timeout releases the shared request and a late response cannot overwrite a retry', async () => {
  const { state, cache } = setup(saved([gym('saved')])); const gate = deferred(); state.fetch = () => gate.promise;
  const work = cache.refresh(); await flush();
  for (const timeout of state.timers.values()) timeout();
  await work; assert.equal(state.signals[0].aborted, true); assert.equal(cache.getSnapshot().refreshing, false);
  assert.equal(cache.getSnapshot().data[0].id, 'saved');
  state.fetch = async () => ({ data: [gym('retry')], error: null }); await cache.refresh(true);
  gate.resolve({ data: [gym('late')], error: null }); await flush();
  assert.equal(cache.getSnapshot().data[0].id, 'retry');
});

test('map markers exclude missing or out-of-range coordinates and normalize nullable labels', () => {
  const { markers } = setup();
  const result = markers([gym(), { ...gym('missing'), lat: null }, { ...gym('invalid'), lng: 200 }]);
  assert.equal(result.length, 1); assert.equal(result[0].addr, ''); assert.equal(result[0].general_info, '');
});
