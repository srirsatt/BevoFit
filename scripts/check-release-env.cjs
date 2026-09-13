function validateReleaseEnv(env) {
  const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE'];
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing build environment variables: ${missing.join(', ')}. Configure them in the EAS environment selected by this build profile.`);
  }
  try {
    if (new URL(env.EXPO_PUBLIC_SUPABASE_URL).protocol !== 'https:') throw new Error();
  } catch {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must be an HTTPS URL.');
  }
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE.trim();
  if (key.startsWith('sb_publishable_')) return;
  // Allow the legacy public anon JWT, but never embed an administrative key.
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (key.split('.').length === 3 && payload.role === 'anon') return;
  } catch {}
  throw new Error('EXPO_PUBLIC_SUPABASE_PUBLISHABLE must contain a publishable key or legacy anon key, never a secret/service-role key.');
}

module.exports = { validateReleaseEnv };

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  try {
    validateReleaseEnv(process.env);
    console.log('Public catalog build environment is configured.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
