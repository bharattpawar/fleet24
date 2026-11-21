// Extends app.json with values that must come from the environment at build time.
// Android Google Maps (react-native-maps) needs a Maps SDK key baked into the native build.
module.exports = ({ config }) => {
  const androidMapsKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ...(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ? [
        ['@react-native-google-signin/google-signin', {
          iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.split('.').reverse().join('.'),
        }],
      ] : []),
    ],
    extra: {
      ...config.extra,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    },
    android: {
      ...config.android,
      config: {
        ...(config.android && config.android.config),
        ...(androidMapsKey ? { googleMaps: { apiKey: androidMapsKey } } : {}),
      },
    },
  };
};
