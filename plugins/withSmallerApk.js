/**
 * Gradle settings that keep the release APK small. They are written into android/gradle.properties
 * on every prebuild, so local, GitHub Actions and F-Droid builds all get them.
 *
 * - expo.useLegacyPackaging=true: store native libraries (React Native, Hermes, Expo modules)
 *   compressed in the APK. By default they are stored uncompressed, which roughly doubles the
 *   download for an APK installed directly (GitHub releases, F-Droid). They are unpacked once at
 *   install time instead.
 * - expo.gif.enabled / expo.webp.enabled=false: drop the GIF and WebP image decoders. The app
 *   only ships PNGs. Re-enable these if you ever add GIF or WebP images.
 *
 * Which processor types (ABIs) to build is chosen per build, not here: the workflow passes
 * -PreactNativeArchitectures=... so each APK only carries one copy of the native libraries.
 */
const { withGradleProperties } = require('expo/config-plugins');

const PROPERTIES = {
  'expo.useLegacyPackaging': 'true',
  'expo.gif.enabled': 'false',
  'expo.webp.enabled': 'false',
};

module.exports = function withSmallerApk(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPERTIES)) {
      const existing = cfg.modResults.find((item) => item.type === 'property' && item.key === key);
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
