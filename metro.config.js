// const { getDefaultConfig } = require("expo/metro-config");
// const { withNativeWind } = require("nativewind/metro");

// const config = getDefaultConfig(__dirname);

// // Extend transformer to use SVG transformer
// config.transformer = {
//   ...config.transformer,
//   babelTransformerPath: require.resolve("react-native-svg-transformer"),
// };

// // Update resolver to support SVG files
// config.resolver.assetExts = config.resolver.assetExts.filter(
//   (ext) => ext !== "svg",
// );
// config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

// // Pass through NativeWind's transformer
// module.exports = withNativeWind(config, {
//   input: "./globals.css",
//   inlineRem: 16,
// });
