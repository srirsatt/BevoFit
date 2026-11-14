const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function directionsCallback(file, component, callback) {
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(__dirname, '../src/screens', file), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = source.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : []);
  const body = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === component)?.body
    ?? declarations.find(node => node.name.getText(source) === component).initializer.body;
  const fn = body.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
    .find(node => node.name.getText(source) === callback).initializer.getText(source);
  return ts.transpileModule(`exports.open = ${fn};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
}

const facility = { name: 'Gregory Gym', addr: '2101 Speedway, Austin, TX', lat: 30.284, lng: -97.734 };
for (const [screen, code] of [
  ['Map', directionsCallback('Map.tsx', 'Map', 'openDirections')],
  ['Calendar', directionsCallback('Calendar.tsx', 'CalendarCard', 'openClassDirections')],
]) {
  for (const platform of ['android', 'ios']) {
    test(`${screen} walking directions use the available maps app on ${platform}`, async () => {
      const calls = [];
      const exports = {};
      vm.runInNewContext(code, {
        exports, facility, Platform: { OS: platform },
        Haptics: { impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } },
        showLocation: async options => { calls.push(options); },
        Alert: { alert: () => assert.fail('Directions should not show an error') },
      });
      await exports.open(facility);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].directionsMode, 'walk');
      assert.equal(calls[0].appsWhiteList[0], platform === 'android' ? 'google-maps' : 'apple-maps');
      assert.equal(calls[0].latitude, facility.lat);
      assert.equal(calls[0].longitude, facility.lng);
      if (platform === 'android') {
        assert.equal(calls[0].alwaysIncludeGoogle, true);
        assert.equal(calls[0].googleForceLatLon, true);
      }
    });
  }
}
