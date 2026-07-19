// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const exclusionList = require("metro-config/src/defaults/exclusionList");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.blacklistRE = exclusionList([
  /.*\/apps\/web\/\.next\/.*$/,
]);

// `react-native-maps` has no web support and imports native-only modules
// (e.g. codegenNativeCommands), which breaks the entire web bundle.
// Stub it out on the web platform so the rest of the app can bundle.
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Keep React DOM aligned with the mobile workspace's React version. In this
  // monorepo the web app hoists a newer react-dom at the repository root,
  // which Metro would otherwise resolve for Expo's web runtime.
  if (moduleName === "react-dom" || moduleName.startsWith("react-dom/")) {
    const mobileReactDomModule = require.resolve(moduleName, {
      paths: [__dirname],
    });

    return context.resolveRequest(context, mobileReactDomModule, platform);
  }

  if (
    platform === "web" &&
    (moduleName === "react-native-maps" ||
      moduleName.startsWith("react-native-maps/"))
  ) {
    return { type: "empty" };
  }

  // Prefer compiled build: Metro following package "react-native" -> src/
  // breaks on relative TS imports inside react-native-svg on Windows.
  if (moduleName === "react-native-svg") {
    return {
      type: "sourceFile",
      filePath: path.resolve(
        __dirname,
        "../../node_modules/react-native-svg/lib/commonjs/index.js",
      ),
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
