const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Helper to fix Windows paths in Regex
function escape(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the root (for shared packages)
config.watchFolders = [workspaceRoot];

// 2. Force Metro to look in apps/mobile/node_modules FIRST
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Block the Root React/React Native to prevent conflicts
//    We use the escape() function to ensure this works on Windows
config.resolver.blockList = [
  // new RegExp(
  //   `^${escape(path.resolve(workspaceRoot, "node_modules/react"))}/.*$`,
  // ),
  // new RegExp(
  //   `^${escape(path.resolve(workspaceRoot, "node_modules/react-native"))}/.*$`,
  // ),
  // new RegExp(
  //   `^${escape(path.resolve(workspaceRoot, "node_modules/expo-router"))}/.*$`,
  // ),
];

// 4. Force alias to the local versions
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // react: path.resolve(projectRoot, "node_modules/react"),
  // "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  // "expo-router": path.resolve(projectRoot, "node_modules/expo-router"),
};

module.exports = config;
