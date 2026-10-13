import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-screens/experimental";

/**
 * Keeps a tab screen's content clear of the native tab bar.
 *
 * Android: expo-router already applies the bottom inset to every native tabs
 * screen, so this is a plain container. iOS: only the first nested scroll view
 * gets automatic insets, so anything else (a pinned checkout bar, a second
 * scrolling pane) would sit under the tab bar. The tab triggers that use this
 * component set `disableAutomaticContentInsets` on iOS and this view applies
 * the bottom inset instead.
 */
export function TabScreenBody({ children }: { children: ReactNode }) {
  if (Platform.OS !== "ios") {
    return <View style={styles.fill}>{children}</View>;
  }
  return (
    <SafeAreaView collapsable={false} edges={{ bottom: true }} style={styles.fill}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
