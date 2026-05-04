const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Windows can block Metro's child-process transformer worker with EPERM.
// Keeping transforms in-process avoids the bundler getting stuck at "Bundling".
config.maxWorkers = 1;

module.exports = config;
