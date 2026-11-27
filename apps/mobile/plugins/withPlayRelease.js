// Expo config plugin: Google Play release signing and version code, applied at `expo prebuild`.
//
// Release builds are signed with the upload key when Codemagic provides one (android_signing in
// codemagic.yaml exports CM_KEYSTORE_PATH, CM_KEYSTORE_PASSWORD, CM_KEY_ALIAS, CM_KEY_PASSWORD).
// Without those variables the release build keeps the debug key, so the sideload APK workflow still works.
// The keystore and its passwords never live in this repository.
//
// versionCode comes from the ANDROID_VERSION_CODE environment variable when set (Play needs a higher
// number for every upload); otherwise it stays at the value in app.json.
const { withAppBuildGradle } = require('@expo/config-plugins');

const SIGNING = `
        release {
            if (System.getenv("CM_KEYSTORE_PATH")) {
                storeFile file(System.getenv("CM_KEYSTORE_PATH"))
                storePassword System.getenv("CM_KEYSTORE_PASSWORD")
                keyAlias System.getenv("CM_KEY_ALIAS")
                keyPassword System.getenv("CM_KEY_PASSWORD")
            }
        }`;

module.exports = function withPlayRelease(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes('CM_KEYSTORE_PATH')) return cfg; // already applied

    // 1. A "release" signing config next to the debug one.
    g = g.replace(/signingConfigs\s*\{\s*\n(\s*)debug\s*\{[\s\S]*?\n\1\}/, (m) => m + SIGNING);

    // 2. Release build type (inside buildTypes, not the signing config above): upload key when present, debug otherwise.
    const at = g.indexOf('buildTypes {');
    if (at < 0) throw new Error('withPlayRelease: no buildTypes block in build.gradle');
    g = g.slice(0, at) + g.slice(at).replace(
      /(\n\s*release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig System.getenv("CM_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug',
    );

    // 3. versionCode from the environment when provided.
    // Integer.parseInt(...) as one argument: `versionCode (x).toInteger()` would parse as versionCode(x).toInteger().
    g = g.replace(/versionCode (\d+)/, (_m, n) => `versionCode Integer.parseInt(System.getenv("ANDROID_VERSION_CODE") ?: "${n}")`);

    if (!g.includes('signingConfigs.release') || !g.includes('ANDROID_VERSION_CODE')) {
      throw new Error('withPlayRelease: build.gradle template changed; update plugins/withPlayRelease.js');
    }
    cfg.modResults.contents = g;
    return cfg;
  });
};
