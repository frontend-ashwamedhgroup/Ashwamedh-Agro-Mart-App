import { useNetworkState } from "expo-network";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";

/**
 * Shows a banner at the top of the app while the device has no internet.
 * `isConnected` / `isInternetReachable` are undefined until the first check
 * completes, so only an explicit `false` counts as offline.
 */
export function NetworkBanner() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isConnected, isInternetReachable } = useNetworkState();

  const isOffline = isConnected === false || isInternetReachable === false;
  if (!isOffline) {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[
        styles.banner,
        { backgroundColor: theme.colors.error, paddingTop: insets.top + 8 },
      ]}
    >
      <Text style={styles.text}>{t("network.offline")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    left: 0,
    paddingBottom: 8,
    paddingHorizontal: 16,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 1000,
  },
  text: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", textAlign: "center" },
});
