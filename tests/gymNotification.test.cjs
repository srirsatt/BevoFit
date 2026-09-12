const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/contexts/GymNotificationContext.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    esModuleInterop: true, jsx: ts.JsxEmit.React },
}).outputText;

const tap = (id, facilityId = 'greg', actionIdentifier = 'default') => ({ actionIdentifier,
  notification: { request: { identifier: id, content: { data: { facilityId } } } } });

// Run the provider's hooks/effects with native notification and navigation
// boundaries mocked. This verifies state transitions, not native UI animation.
function setup(options = {}) {
  const state = { response: null, ready: true, useClassic: false, routes: [], clears: 0, ...options };
  const slots = [];
  let cursor = 0, effects = [], dirty = false, value;
  const equal = (a, b) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    createElement: (type, props) => ({ type, props }),
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useState(initial) {
      const i = cursor++;
      slots[i] ??= { value: initial };
      return [slots[i].value, next => {
        const result = typeof next === 'function' ? next(slots[i].value) : next;
        if (!Object.is(result, slots[i].value)) { slots[i].value = result; dirty = true; }
      }];
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) { slots[i] = { deps }; effects.push(fn); }
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { deps, fn };
      return slots[i].fn;
    },
  };
  const router = { navigate: route => state.routes.push(route) };
  const dependencies = {
    react,
    'expo-router': { useRouter: () => router, useRootNavigationState: () => state.ready ? { key: 'root' } : undefined },
    'expo-notifications': {
      DEFAULT_ACTION_IDENTIFIER: 'default',
      useLastNotificationResponse: () => state.response,
      getLastNotificationResponse: () => state.response,
      clearLastNotificationResponse: () => { state.clears++; state.response = null; dirty = true; },
    },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  function render() {
    let renders = 0;
    do {
      assert.ok(++renders < 20, 'Provider should settle without a render loop');
      dirty = false; cursor = 0; effects = [];
      value = exports.GymNotificationProvider({ useClassic: state.useClassic, children: null }).props.value;
      effects.forEach(fn => fn());
    } while (dirty);
    return value;
  }
  return { state, render };
}

test('ordinary launch does not navigate or create a gym request', () => {
  const { state, render } = setup();
  assert.equal(render().pendingGym, null);
  assert.deepEqual(state.routes, []);
});

test('cold-start tap waits for navigation, stays pending until Home consumes, then clears native response', () => {
  const { state, render } = setup({ response: tap('cold'), ready: false });
  assert.equal(render().pendingGym.facilityId, 'greg');
  assert.deepEqual(state.routes, []);
  state.ready = true;
  const value = render();
  assert.deepEqual(state.routes, ['/']);
  assert.equal(render().pendingGym.notificationId, 'cold');
  value.consumeGymNotification('cold');
  assert.equal(render().pendingGym, null);
  assert.equal(state.response, null);
  assert.equal(state.clears, 1);
  assert.equal(render().pendingGym, null);
});

test('live taps route once and a duplicate consumed response cannot reopen a gym', () => {
  const { state, render } = setup();
  render();
  state.response = tap('warm');
  render().consumeGymNotification('warm');
  render();
  state.response = tap('warm');
  assert.equal(render().pendingGym, null);
  assert.deepEqual(state.routes, ['/']);
});

test('finishing an old tap preserves the newer gym request and native response', () => {
  const { state, render } = setup({ response: tap('first') });
  const first = render();
  state.response = tap('second', 'rec');
  render();
  first.consumeGymNotification('first');
  assert.equal(render().pendingGym.facilityId, 'rec');
  assert.equal(state.response.notification.request.identifier, 'second');
  assert.equal(state.clears, 0);
  render().consumeGymNotification('second');
  assert.equal(render().pendingGym, null);
  assert.equal(state.clears, 1);
});

test('classic tabs receive the pending gym without native-router navigation', () => {
  const { state, render } = setup({ response: tap('classic'), useClassic: true });
  assert.equal(render().pendingGym.facilityId, 'greg');
  assert.deepEqual(state.routes, []);
});

test('ignores unrelated, malformed, and non-default notification actions', () => {
  const { state, render } = setup();
  for (const response of [tap('empty', ''), tap('space', ' '), tap('numeric', 123), tap('dismiss', 'greg', 'dismiss')]) {
    state.response = response;
    assert.equal(render().pendingGym, null);
  }
  assert.deepEqual(state.routes, []);
});
