// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [...config.resolver.assetExts, 'tflite'];

config.resolver.sourceExts = config.resolver.sourceExts.filter(ext => ext !== 'tflite');

module.exports = withNativeWind(config, { input: './global.css' });