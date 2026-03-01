const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the engine files at the repo root
config.watchFolders = [repoRoot];

// Map 'sudoku-engine' to the repo root's index.ts
config.resolver.extraNodeModules = {
  'sudoku-engine': path.resolve(repoRoot, 'index.ts'),
};

// Metro 0.83 (SDK 54) respects npm package `exports` fields, which causes the
// `ws` package to resolve via its Node.js entry and pull in `stream`/`events`.
// React Native has a native WebSocket, so redirect bare `ws` imports to the
// browser stub before the exports map runs.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ws') {
    return {
      filePath: path.resolve(projectRoot, 'node_modules/ws/browser.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Ensure Metro resolves TypeScript files from the repo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
];

module.exports = config;
