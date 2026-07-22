const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// whisper.rn → safe-buffer → Node's `buffer`, which React Native lacks.
// Map the builtin to the npm polyfill so Metro can bundle it.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer'),
};

module.exports = config;
