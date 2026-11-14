const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateReleaseEnv } = require('../scripts/check-release-env.cjs');
const valid = { EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE: 'sb_publishable_test' };
const jwt = (role) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;

test('release environment accepts the two supported public key formats', () => {
  assert.doesNotThrow(() => validateReleaseEnv(valid));
  assert.doesNotThrow(() => validateReleaseEnv({ ...valid, EXPO_PUBLIC_SUPABASE_PUBLISHABLE: jwt('anon') }));
});

test('missing environment fails before building and identifies only variable names', () => {
  assert.throws(() => validateReleaseEnv({}), /EXPO_PUBLIC_SUPABASE_URL.*EXPO_PUBLIC_SUPABASE_PUBLISHABLE/);
  assert.throws(() => validateReleaseEnv({ ...valid, EXPO_PUBLIC_SUPABASE_PUBLISHABLE: ' ' }), /Missing/);
});

test('Android cloud builds require a Maps key before compiling an unusable map', () => {
  const android = { ...valid, EAS_BUILD_PLATFORM: 'android' };
  assert.throws(() => validateReleaseEnv(android), /ANDROID_GOOGLE_MAPS_API_KEY/);
  assert.throws(() => validateReleaseEnv({ ...android, ANDROID_GOOGLE_MAPS_API_KEY: ' ' }), /ANDROID_GOOGLE_MAPS_API_KEY/);
  assert.doesNotThrow(() => validateReleaseEnv({ ...android, ANDROID_GOOGLE_MAPS_API_KEY: 'test-maps-key' }));
  assert.doesNotThrow(() => validateReleaseEnv({ ...valid, EAS_BUILD_PLATFORM: 'ios' }));
});

test('malformed and insecure backend URLs are rejected', () => {
  for (const url of ['localhost', 'http://example.supabase.co', 'file:///tmp/backend']) {
    assert.throws(() => validateReleaseEnv({ ...valid, EXPO_PUBLIC_SUPABASE_URL: url }), /HTTPS/);
  }
});

test('administrative keys are rejected without printing their value', () => {
  for (const key of ['sb_secret_never_print_this', jwt('service_role'), 'malformed']) {
    assert.throws(() => validateReleaseEnv({ ...valid, EXPO_PUBLIC_SUPABASE_PUBLISHABLE: key }), (error) => {
      assert.match(error.message, /never a secret\/service-role key/);
      assert.equal(error.message.includes(key), false);
      return true;
    });
  }
});
