const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get the default Expo Metro config
const config = getDefaultConfig(__dirname);

// Add your custom configuration here
config.resolver.extraNodeModules = {
  // This maps the 'react-native' module to your project's `node_modules`
  'react-native': path.resolve(__dirname, 'node_modules/react-native'),
  // You can add other modules here if they're not being resolved correctly
};

// Add watch folders to include packages that aren't in your root node_modules
config.watchFolders = [
  // This ensures Metro watches for changes in your project's files
  __dirname,
];

module.exports = config;