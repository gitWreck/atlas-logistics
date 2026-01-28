// apps/mobile/metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the workspace root (so it sees node_modules at the top)
config.watchFolders = [workspaceRoot];

// 2. Tell Metro where to find node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. ⚠️ THE FIX: Force Metro to use CJS instead of ESM ⚠️
// By removing 'module' from this list, we stop it from loading index.esm.js
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

// 4. Ensure .cjs files are treated as source code
config.resolver.sourceExts = [...config.resolver.sourceExts, "cjs"];

module.exports = config;
