const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute Home's actual modal callbacks without loading native view modules.
// Native sheet presentation itself still needs a device smoke test.
const source = ts.createSourceFile('Home.tsx', fs.readFileSync(path.join(__dirname, '../src/screens/Home.tsx'), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const home = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'Home');
const callback = name => home.body.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
  .find(node => node.name.getText(source) === name).initializer.getText(source);
const notificationEffect = home.body.statements.find(node => ts.isExpressionStatement(node)
  && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === 'useEffect'
  && node.getText(source).includes('consumeGymNotification(pendingGym.notificationId)'));
const code = ts.transpileModule(`
  const handleModalPress = ${callback('handleModalPress')};
  exports.open = handleModalPress;
  exports.dismiss = ${callback('onDismiss')};
  exports.checkPending = ${notificationEffect.expression.arguments[0].getText(source)};
`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;

function setup(overrides = {}) {
  const state = { selected: null, saved: null, community: null, presents: 0, consumed: [], alerts: [], errors: [] };
  const exports = {};
  const env = {
    exports, useCallback: fn => fn, isPresentingRef: { current: false }, modalRequestRef: { current: 0 },
    sheetRef: { current: { present: () => state.presents++ } },
    setSelectedGymId: id => { state.selected = id; }, setSelectedBusyness: value => { state.saved = value; },
    setCommunityBusyness: value => { state.community = value; },
    getSavedReport: async () => 1, getFacilityBusyness: async () => 2,
    Haptics: { impactAsync() {}, ImpactFeedbackStyle: { Medium: 'medium' } },
    console: { error: error => state.errors.push(error) },
    isFocused: true, gymsLoading: false, gymsError: null, gyms: [{ id: 'greg' }, { id: 'rec' }],
    facilities: { refreshing: false, error: null },
    pendingGym: { notificationId: 'tap', facilityId: 'greg' },
    consumeGymNotification: id => state.consumed.push(id),
    Alert: { alert: (...args) => state.alerts.push(args) }, ...overrides,
  };
  vm.runInNewContext(code, env);
  return { state, env, ...exports };
}

test('tap waits for Home focus, gym loading, and recovery from fetch errors', () => {
  const { state, env, checkPending } = setup({ isFocused: false });
  checkPending();
  env.isFocused = true; env.gymsLoading = true; checkPending();
  env.gymsLoading = false; env.gymsError = 'offline'; checkPending();
  assert.equal(state.presents, 0);
  assert.deepEqual(state.consumed, []);
  env.gymsError = null; checkPending();
  assert.equal(state.selected, 'greg');
  assert.equal(state.presents, 1);
  assert.deepEqual(state.consumed, ['tap']);
});

test('a notification for a gym missing from saved data waits for a successful refresh', () => {
  const { state, env, checkPending } = setup({ gyms: [], facilities: { refreshing: true, error: null } });
  checkPending();
  assert.equal(state.consumed.length, 0);
  assert.equal(state.alerts.length, 0);
  env.facilities = { refreshing: false, error: 'offline' };
  checkPending();
  assert.equal(state.consumed.length, 0);
  env.facilities = { refreshing: false, error: null };
  env.gyms = [{ id: 'greg' }];
  checkPending();
  assert.equal(state.selected, 'greg');
  assert.deepEqual(state.consumed, ['tap']);
});

test('tap replaces an already open gym using the same sheet', async () => {
  const { state, env, open, checkPending } = setup();
  await open({ id: 'greg' });
  env.pendingGym = { notificationId: 'rec-tap', facilityId: 'rec' };
  checkPending();
  assert.equal(state.selected, 'rec');
  assert.equal(state.presents, 1);
  assert.deepEqual(state.consumed, ['rec-tap']);
});

test('slow crowd data for the old gym cannot overwrite the newly selected gym', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { state, open } = setup({ getFacilityBusyness: id => id === 'greg' ? gate : Promise.resolve(4) });
  const first = open({ id: 'greg' });
  await open({ id: 'rec' }, true);
  release(1); await first;
  assert.equal(state.selected, 'rec');
  assert.equal(state.community, 4);
});

test('dismissed sheet ignores outstanding data and allows reopening', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { state, open, dismiss } = setup({ getFacilityBusyness: () => gate });
  const first = open({ id: 'greg' });
  dismiss(); release(4); await first;
  assert.equal(state.community, null);
  await open({ id: 'rec' });
  assert.equal(state.presents, 2);
});

test('removed gym gets an explanation and consumes the tap without opening a wrong gym', () => {
  const { state, checkPending } = setup({ gyms: [] });
  checkPending();
  assert.equal(state.presents, 0);
  assert.equal(state.alerts[0][0], 'Gym unavailable');
  assert.deepEqual(state.consumed, ['tap']);
});

test('crowd lookup failure leaves gym details open without an unhandled rejection', async () => {
  const { state, open } = setup({ getFacilityBusyness: async () => { throw new Error('offline'); } });
  await open({ id: 'greg' });
  assert.equal(state.selected, 'greg');
  assert.equal(state.presents, 1);
  assert.equal(state.errors.length, 1);
});
