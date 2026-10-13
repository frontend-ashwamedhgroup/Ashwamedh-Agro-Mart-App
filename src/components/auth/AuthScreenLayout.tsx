import type { ReactNode } from "react";
import { Image } from "expo-image";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../../theme";

type AuthScreenLayoutProps = {
  children: ReactNode;
};

export function AuthScreenLayout({ children }: AuthScreenLayoutProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <Image
              accessibilityLabel="Ashwamedh Agro Mart logo"
              contentFit="contain"
              source={require("../../../assets/images/icon.png")}
              style={styles.brandLogo}
            />
          </View>

          {children}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  content: {
    alignSelf: "center",
    maxWidth: 440,
    width: "100%",
  },
  brandRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  brandLogo: {
    height: 120,
    width: 120,
  },
});
