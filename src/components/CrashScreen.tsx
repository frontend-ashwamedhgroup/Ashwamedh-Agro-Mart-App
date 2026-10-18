// Friendly fallback shown when a screen throws while rendering, instead of a blank app.
//
// Used as the root ErrorBoundary, so it replaces the root layout and its
// providers (theme, safe area): everything here must work without them.
import { Ionicons } from "@expo/vector-icons";
import * as Sentry from "@sentry/react-native";
import type { ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";

import { colors } from "../theme";

export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const palette = useColorScheme() === "dark" ? colors.dark : colors.light;
  const insets = initialWindowMetrics?.insets;
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    // An error caught by a boundary never reaches Sentry's global handler.
    Sentry.captureException(error);
    // The crash may happen before the app had a chance to hide the splash.
    SplashScreen.hide();
  }, [error]);

  // A full reload starts the app fresh, for when "Try again" hits the same error.
  const restart = async () => {
    setIsRestarting(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setIsRestarting(false);
      void retry();
    }
  };

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        { backgroundColor: palette.background, paddingTop: insets?.top, paddingBottom: insets?.bottom },
      ]}
    >
      {/* Error red, with a soft tint of it (10% / 25% alpha) behind the icon. */}
      <View style={[styles.iconCircle, { backgroundColor: `${palette.error}1A`, borderColor: `${palette.error}40` }]}>
        <Ionicons color={palette.error} name="alert-circle-outline" size={52} />
      </View>

      <Text style={[styles.title, { color: palette.text }]}>{t("crash.title")}</Text>
      <Text style={[styles.message, { color: palette.textSecondary }]}>{t("crash.message")}</Text>

      {__DEV__ ? (
        // Developers only; farmers never see technical details.
        <Text selectable style={[styles.detail, { color: palette.textMuted }]}>
          {error.message}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={isRestarting}
          onPress={() => void retry()}
          style={({ pressed }) => [styles.button, { backgroundColor: palette.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons color={palette.onPrimary} name="refresh" size={18} />
          <Text style={[styles.buttonText, { color: palette.onPrimary }]}>{t("crash.retry")}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: isRestarting }}
          disabled={isRestarting}
          onPress={() => void restart()}
          style={({ pressed }) => [
            styles.button,
            styles.secondary,
            { borderColor: palette.border, backgroundColor: palette.surface, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {isRestarting ? (
            <ActivityIndicator color={palette.text} />
          ) : (
            <Text style={[styles.buttonText, { color: palette.text }]}>{t("crash.restart")}</Text>
          )}
        </Pressable>
      </View>

      <Text style={[styles.footer, { color: palette.textMuted }]}>{t("crash.reassure")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", flex: 1, gap: 12, justifyContent: "center", paddingHorizontal: 32 },
  iconCircle: {
    alignItems: "center",
    borderRadius: 60,
    borderWidth: 1,
    height: 120,
    justifyContent: "center",
    marginBottom: 12,
    width: 120,
  },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  message: { fontSize: 15, lineHeight: 22, maxWidth: 340, textAlign: "center" },
  detail: { fontSize: 12, textAlign: "center" },
  actions: { gap: 12, marginTop: 16, maxWidth: 360, width: "100%" },
  button: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 28,
  },
  secondary: { borderWidth: 1 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  footer: { fontSize: 13, lineHeight: 19, marginTop: 8, maxWidth: 320, textAlign: "center" },
});
