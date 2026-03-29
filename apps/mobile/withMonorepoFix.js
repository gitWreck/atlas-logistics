const { withGradleProperties } = require("@expo/config-plugins");

module.exports = function withMonorepoFix(config) {
  return withGradleProperties(config, (config) => {
    // This tells the Android build exactly where to find react-native in your root node_modules
    config.modResults.push({
      type: "property",
      key: "REACT_NATIVE_NODE_MODULES_DIR",
      value: "../../../node_modules/react-native",
    });
    return config;
  });
};
