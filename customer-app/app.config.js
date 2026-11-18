// Extends app.json with values that must come from the environment at build time.
// Android Google Maps (react-native-maps) needs a Maps SDK key baked into the native build.
module.exports = ({ config }) => {
  const androidMapsKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android && config.android.config),
        ...(androidMapsKey ? { googleMaps: { apiKey: androidMapsKey } } : {}),
      },
    },
  };
};
