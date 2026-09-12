// Run with: node --test tests/facilityGeofencing.test.cjs
// Native services are mocked so permission and persistence behavior can be
// verified without changing a simulator's permissions or sending notifications.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/facilityGeofencing.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;

function setup(overrides = {}) {
  const state = {
    preference: null, monitoring: false, precise: true, locationEnabled: true,
    notifications: true, foreground: true, background: true, os: 'ios',
    notificationRequestGranted: true, backgroundRequestGranted: true,
    fetchError: false, stopError: false, storageError: false,
    fetchGate: null,
    facilities: [{ id: 'greg', lat: 30.28, lng: -97.73, geofence_radius_meters: 100 }],
    calls: [], ...overrides,
  };
  let task;
  const storage = {
    async getItem() {
      if (state.storageError) throw new Error('storage unavailable');
      return state.preference;
    },
    async setItem(key, value) { state.preference = value; },
  };
  const location = {
    GeofencingEventType: { Enter: 1, Exit: 2 },
    hasStartedGeofencingAsync: async () => state.monitoring,
    hasServicesEnabledAsync: async () => state.locationEnabled,
    getForegroundPermissionsAsync: async () => ({ granted: state.foreground, canAskAgain: true }),
    getBackgroundPermissionsAsync: async () => ({ granted: state.background, canAskAgain: true }),
    requestForegroundPermissionsAsync: async () => {
      state.calls.push('prompt:foreground');
      state.foreground = true;
      return { granted: true };
    },
    requestBackgroundPermissionsAsync: async () => {
      state.calls.push('prompt:background');
      state.foreground = true;
      state.background = state.backgroundRequestGranted;
      return { granted: state.background };
    },
    startGeofencingAsync: async (name, regions) => {
      state.calls.push('register');
      state.regions = regions;
      state.monitoring = true;
    },
    stopGeofencingAsync: async () => {
      state.calls.push('stop');
      if (state.stopError) throw new Error('native stop failed');
      state.monitoring = false;
    },
  };
  const dependencies = {
    '@react-native-async-storage/async-storage': storage,
    'react-native': { Platform: { OS: state.os } },
    'expo-location': location,
    'expo-task-manager': {
      isTaskDefined: () => false,
      defineTask: (name, callback) => { task = callback; },
      isAvailableAsync: async () => true,
      getTaskOptionsAsync: async () => ({ regions: state.regions }),
    },
    '../../modules/location-accuracy': { hasPreciseLocationPermission: async () => state.precise },
    './facilityNotifications': {
      hasNotificationPermission: async () => state.notifications,
      requestNotificationPermissions: async () => {
        state.calls.push('prompt:notifications');
        state.notifications = state.notificationRequestGranted;
        return state.notifications;
      },
    },
    './nearbyFacilityProximity': {
      loadProximityFacilities: async () => {
        state.calls.push('fetch');
        if (state.fetchGate) await state.fetchGate;
        if (state.fetchError) throw new Error('offline');
        return state.facilities;
      },
      handleFacilityEntry: async (id) => { state.calls.push(`notify:${id}`); return true; },
    },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    console: { error() {}, log() {} },
    __DEV__: false,
  });
  return { state, service: exports, enter: () => task({ data: { eventType: 1, region: { identifier: 'greg' } } }) };
}

const hasPrompts = (state) => state.calls.some((call) => call.startsWith('prompt:'));

test('first use is undecided, without prompting or registering', async () => {
  const { state, service } = setup();
  const result = await service.refreshFacilityGeofencing();
  assert.equal(result.preference, null);
  assert.equal(result.monitoring, false);
  assert.deepEqual(state.calls, []);
});

test('existing opt-outs persist across service restarts and suppress queued entries', async () => {
  const first = setup();
  await first.service.stopFacilityGeofencing();
  const next = setup({ preference: first.state.preference });
  assert.equal((await next.service.refreshFacilityGeofencing()).preference, 'disabled');
  await next.enter();
  assert.deepEqual(next.state.calls, []);
});

test('explicit enable requests missing permissions and registers Supabase radii', async () => {
  const { state, service } = setup({ notifications: false, foreground: false, background: false });
  const result = await service.startFacilityGeofencing();
  assert.equal(result.monitoring, true);
  assert.equal(state.preference, 'enabled');
  assert.ok(hasPrompts(state));
  assert.equal(state.regions[0].radius, 100);
  assert.equal(state.regions[0].identifier, 'greg');
});

test('startup preserves existing opt-ins without prompting', async () => {
  const { state, service } = setup({ monitoring: true });
  const result = await service.refreshFacilityGeofencing();
  assert.equal(result.preference, 'enabled');
  assert.equal(state.preference, 'enabled');
  assert.equal(hasPrompts(state), false);
});

test('revoked Always permission pauses monitoring without prompting, then recovers', async () => {
  const { state, service } = setup({ preference: 'enabled', monitoring: true, background: false });
  const result = await service.refreshFacilityGeofencing();
  assert.equal(result.monitoring, false);
  assert.equal(result.needsSettings, true);
  assert.match(result.issue, /Always/);
  assert.equal(state.preference, 'enabled');
  assert.equal(hasPrompts(state), false);
  state.background = true;
  assert.equal((await service.refreshFacilityGeofencing()).monitoring, true);
  assert.equal(hasPrompts(state), false);
});

test('reduced accuracy stops monitoring and suppresses delivery', async () => {
  const { state, service, enter } = setup({ preference: 'enabled', monitoring: true, precise: false });
  const result = await service.refreshFacilityGeofencing();
  assert.equal(result.monitoring, false);
  assert.match(result.issue, /Precise Location/);
  await enter();
  assert.equal(state.calls.includes('notify:greg'), false);
});

test('network failure preserves registered regions and retries next refresh', async () => {
  const { state, service } = setup({ preference: 'enabled', monitoring: true, fetchError: true });
  assert.equal((await service.refreshFacilityGeofencing()).monitoring, true);
  assert.equal(state.calls.includes('stop'), false);
  state.fetchError = false;
  assert.equal((await service.refreshFacilityGeofencing()).issue, null);
});

test('foreground refresh skips unchanged regions but applies changed Supabase radii', async () => {
  const { state, service } = setup({ preference: 'enabled' });
  await service.refreshFacilityGeofencing();
  await service.refreshFacilityGeofencing();
  assert.equal(state.calls.filter((call) => call === 'register').length, 1);
  state.facilities[0].geofence_radius_meters = 125;
  await service.refreshFacilityGeofencing();
  assert.equal(state.calls.filter((call) => call === 'register').length, 2);
  assert.equal(state.regions[0].radius, 125);
});

test('zero enabled gyms removes old regions but keeps user preference', async () => {
  const { state, service } = setup({ preference: 'enabled', monitoring: true, facilities: [] });
  assert.equal((await service.refreshFacilityGeofencing()).monitoring, false);
  assert.equal(state.preference, 'enabled');
});

test('an in-flight refresh cannot overwrite a later disable', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { state, service, enter } = setup({ preference: 'enabled', fetchGate: gate });
  const refresh = service.refreshFacilityGeofencing();
  const disable = service.stopFacilityGeofencing();
  release();
  await Promise.all([refresh, disable]);
  assert.equal(state.monitoring, false);
  assert.equal(state.preference, 'disabled');
  assert.equal(state.calls.at(-1), 'stop');
  await enter();
  assert.equal(state.calls.includes('notify:greg'), false);
});

test('saved opt-out suppresses events even if native stop fails', async () => {
  const { state, service, enter } = setup({ preference: 'enabled', monitoring: true, stopError: true });
  await assert.rejects(service.stopFacilityGeofencing());
  await enter();
  assert.equal(state.preference, 'disabled');
  assert.equal(state.calls.includes('notify:greg'), false);
});

test('allowed entry delivers without prompting; denied notification permission suppresses it', async () => {
  const { state, enter } = setup({ preference: 'enabled' });
  await enter();
  assert.deepEqual(state.calls, ['notify:greg']);
  state.notifications = false;
  await enter();
  assert.deepEqual(state.calls, ['notify:greg']);
});

test('storage failure never silently opts a user in', async () => {
  const { state, service } = setup({ monitoring: true, storageError: true });
  await assert.rejects(service.refreshFacilityGeofencing());
  assert.equal(hasPrompts(state), false);
  assert.equal(state.calls.includes('register'), false);
});

test('unsupported platforms do not register or prompt', async () => {
  const { state, service } = setup({ os: 'android' });
  assert.equal((await service.refreshFacilityGeofencing()).preference, 'disabled');
  assert.deepEqual(state.calls, []);
});

test('fresh launches and foreground refreshes never ask for permissions or opt users in', async () => {
  const { state, service } = setup({ notifications: false, foreground: false, background: false });
  await Promise.all([
    service.refreshFacilityGeofencing(),
    service.refreshFacilityGeofencing(),
  ]);
  assert.deepEqual(state.calls, []);
  assert.equal(state.preference, null);
  assert.equal(state.monitoring, false);
});

test('notification denial in Settings is not retried on later launches', async () => {
  const { state, service } = setup({ notifications: false, notificationRequestGranted: false });
  const first = await service.startFacilityGeofencing();
  assert.equal(first.monitoring, false);
  assert.match(first.issue, /notifications/);
  const next = setup({ preference: state.preference, notifications: false });
  await next.service.refreshFacilityGeofencing();
  assert.deepEqual(state.calls, ['prompt:notifications']);
  assert.equal(hasPrompts(next.state), false);
});

test('When In Use alone does not enable geofencing or trigger repeated Always requests', async () => {
  const { state, service } = setup({ foreground: false, background: false, backgroundRequestGranted: false });
  const result = await service.startFacilityGeofencing();
  assert.equal(result.monitoring, false);
  assert.match(result.issue, /Always/);
  await service.refreshFacilityGeofencing();
  assert.equal(state.calls.filter((call) => call === 'prompt:background').length, 1);
  assert.equal(state.calls.includes('prompt:foreground'), false);
});
