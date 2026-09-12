const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const sources = Object.fromEntries(['facilityOverlap', 'facilityNotifications', 'nearbyFacilityProximity'].map(name => [name,
  ts.transpileModule(fs.readFileSync(path.join(__dirname, `../src/lib/${name}.ts`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText,
]));

// At the equator, one degree of latitude is approximately 111,195 meters.
const gym = (id, meters, priority = 1) => ({ id, name: id, lat: meters / 111195, lng: 0,
  geofence_radius_meters: 100, priority, notifications_enabled: true });

function setup(facilities, overrides = {}) {
  const state = { facilities, closed: [], sent: [], lookups: [], fixes: 0, now: 10000000,
    latitude: 0, locationFailure: false, locationTimeout: false, permission: true,
    scheduleFailure: false, storage: new Map(), ...overrides };
  const notifications = {
    setNotificationHandler() {}, IosAuthorizationStatus: { PROVISIONAL: 3 },
    getPermissionsAsync: async () => ({ granted: state.permission }),
    scheduleNotificationAsync: async request => {
      if (state.scheduleFailure) throw new Error('delivery failed');
      state.sent.push(request.content.data.facilityId);
    },
  };
  const dependencies = {
    'expo-location': { Accuracy: { High: 4 }, getCurrentPositionAsync: async () => {
      state.fixes++;
      if (state.locationFailure) throw new Error('no fix');
      if (state.locationTimeout) return new Promise(() => {});
      return { coords: { latitude: state.latitude / 111195, longitude: 0 } };
    } },
    'expo-notifications': notifications,
    '@react-native-async-storage/async-storage': {
      getItem: async key => state.storage.get(key) ?? null,
      setItem: async (key, value) => state.storage.set(key, value),
    },
    './facilityHours': { isFacilityOpen: hours => ({ isOpen: hours?.open === true }) },
    './supabase': { supabase: { from(table) {
      let id;
      const query = {
        select() { return query; }, eq(key, value) { if (key === 'id' || key === 'facility_id') id = value; return query; },
        not() { return query; }, gt() { return query; }, order() { return query; },
        then(resolve, reject) { return Promise.resolve({ data: state.facilities, error: null }).then(resolve, reject); },
        async maybeSingle() {
          if (table === 'facility_hours') return { data: { open: !state.closed.includes(id) } };
          state.lookups.push(id);
          return { data: state.facilities.find(f => f.id === id && f.notifications_enabled) ?? null };
        },
      };
      return query;
    } } },
  };
  const modules = {};
  function load(name) {
    if (name in dependencies) return dependencies[name];
    const base = name.replace('./', '');
    if (modules[base]) return modules[base];
    assert.ok(sources[base], `Unexpected dependency ${name}`);
    const exports = modules[base] = {};
    vm.runInNewContext(sources[base], { exports, require: load,
      Date: { now: () => state.now },
      setTimeout: callback => setTimeout(callback, state.locationTimeout ? 0 : 8000), clearTimeout,
    });
    return exports;
  }
  return { state, enter: load('./facilityOverlap').handleOverlappingFacilityEntry };
}

test('overlap picks highest priority regardless of entry order, then suppresses neighboring events', async () => {
  const { state, enter } = setup([gym('bellmont', 0, 3), gym('greg', 50, 10)]);
  assert.equal(await enter('bellmont'), true);
  assert.deepEqual(state.sent, ['greg']);
  assert.equal(await enter('greg'), false);
  assert.equal(await enter('bellmont'), false);
  assert.equal(state.fixes, 1);
  state.now += 3600000;
  assert.equal(await enter('bellmont'), true);
  assert.deepEqual(state.sent, ['greg', 'greg']);
});

test('closed highest priority falls back to the open gym', async () => {
  const { state, enter } = setup([gym('greg', 0, 10), gym('bellmont', 50, 3)], { closed: ['greg'] });
  await enter('greg');
  assert.deepEqual(state.sent, ['bellmont']);
  assert.deepEqual(state.lookups, ['greg', 'bellmont']);
});

test('higher priority outside its own radius cannot win', async () => {
  const { state, enter } = setup([gym('near', 0), gym('far', 150, 10)]);
  await enter('near');
  assert.deepEqual(state.sent, ['near']);
});

test('equal priority chooses nearest, then stable ID for equal distance', async () => {
  const { state, enter } = setup([gym('z', 50), gym('b', 10), gym('a', 10)]);
  await enter('z');
  assert.deepEqual(state.sent, ['a']);
});

test('connected overlaps share history, while a separate gym stays eligible', async () => {
  const { state, enter } = setup([gym('a', 0), gym('b', 150), gym('c', 300), gym('separate', 1000)]);
  await enter('a');
  state.latitude = 300;
  assert.equal(await enter('c'), false);
  assert.equal(await enter('separate'), true);
  assert.deepEqual(state.sent, ['a', 'separate']);
  assert.equal(state.fixes, 1);
});

test('isolated gym needs no additional location request', async () => {
  const { state, enter } = setup([gym('greg', 0)]);
  await enter('greg');
  assert.equal(state.fixes, 0);
  assert.deepEqual(state.sent, ['greg']);
});

for (const overrides of [{ locationFailure: true }, { locationTimeout: true }, { latitude: 1000 }]) {
  test(`uncertain or out-of-range location skips delivery: ${JSON.stringify(overrides)}`, async () => {
    const { state, enter } = setup([gym('a', 0), gym('b', 50)], overrides);
    assert.equal(await enter('a'), false);
    assert.deepEqual(state.sent, []);
    assert.equal(state.storage.size, 0);
  });
}

test('all gyms closed or notifications denied does not consume cooldown', async () => {
  const { state, enter } = setup([gym('a', 0), gym('b', 50)], { closed: ['a', 'b'] });
  assert.equal(await enter('a'), false);
  state.closed = [];
  state.permission = false;
  assert.equal(await enter('a'), false);
  assert.equal(state.storage.size, 0);
  state.permission = true;
  assert.equal(await enter('a'), true);
});

test('failed scheduling does not consume cooldown or try a second notification', async () => {
  const { state, enter } = setup([gym('a', 0), gym('b', 50)], { scheduleFailure: true });
  await assert.rejects(enter('a'), /delivery failed/);
  assert.equal(state.storage.size, 0);
  assert.deepEqual(state.lookups, ['a']);
  state.scheduleFailure = false;
  assert.equal(await enter('a'), true);
});

test('removed and unmonitored gyms are ignored', async () => {
  const { state, enter } = setup(Array.from({ length: 21 }, (_, i) => gym(String(i), i * 1000)));
  assert.equal(await enter('missing'), false);
  assert.equal(await enter('20'), false);
  assert.deepEqual(state.sent, []);
  assert.equal(state.fixes, 0);
});
