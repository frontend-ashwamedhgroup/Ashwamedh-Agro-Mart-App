/**
 * Root layout for the application.
 *
 * The ThemeProvider makes the active theme available
 * throughout the application.
 */

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";

import { NetworkBanner } from "../components/NetworkBanner";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";
import { useLocationPermission } from "../hooks/useLocationPermission";
import { ThemeProvider, useTheme } from "../theme";

void SplashScreen.preventAutoHideAsync();

SplashScreen.setOptions({
  duration: 400,
  fade: true,
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider>
          <LanguageProvider>
            <AuthProvider>
              <SplashScreenController />
              <ThemeProvider>
                <ThemedApp />
              </ThemeProvider>
            </AuthProvider>
          </LanguageProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedApp() {
  const { mode, theme } = useTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(
      (error: unknown) => {
        console.error("Failed to update system background color", error);
      },
    );
  }, [theme.colors.background]);

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <RootNavigator />
      <NetworkBanner />
    </>
  );
}

function SplashScreenController() {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hide();
    }
  }, [isLoading]);

  return null;
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  useLocationPermission(isAuthenticated && !isLoading);

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(protected)" />
      </Stack.Protected>
    </Stack>
  );
}
