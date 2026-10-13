const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getUniqueIdentifier = () => {
  if (IS_DEV) {
    return "com.ashwamedhagromart.dev";
  }

  if (IS_PREVIEW) {
    return "com.ashwamedhagromart.preview";
  }

  return "com.ashwamedhagromart";
};
const getAppName = () => {
  if (IS_DEV) {
    return "Ashwamedh Agro Mart (Dev)";
  }

  if (IS_PREVIEW) {
    return "Ashwamedh Agro Mart (Preview)";
  }

  return "Ashwamedh Agro Mart";
};

// app.json cannot read env vars (the literal text would be baked in as the
// key), so the Google Maps keys are injected here. Android has no keyless map
// fallback: a missing/invalid key renders a blank map there, while iOS falls
// back to Apple Maps.
const withMapsKeys = (plugins = []) =>
  plugins.map((plugin) =>
    Array.isArray(plugin) && plugin[0] === "react-native-maps"
      ? [
          "react-native-maps",
          {
            androidGoogleMapsApiKey:
              process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY,
            iosGoogleMapsApiKey:
              process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY,
          },
        ]
      : plugin,
  );

export default ({ config }) => ({
  ...config,
  name: getAppName(),
  plugins: withMapsKeys(config.plugins),
  ios: {
    ...config.ios,
    bundleIdentifier: getUniqueIdentifier(),
  },
  android: {
    ...config.android,
    package: getUniqueIdentifier(),
  },
});
