/**
 * Root layout for the application.
 *
 * The ThemeProvider makes the active theme available
 * throughout the application.
 */

import * as Sentry from "@sentry/react-native";
import { Stack, useNavigationContainerRef } from "expo-router";
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

import { CrashScreen } from "../components/CrashScreen";
import { NetworkBanner } from "../components/NetworkBanner";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";
import { useLocationPermission } from "../hooks/useLocationPermission";
import { ThemeProvider, useTheme } from "../theme";

const navigationIntegration = Sentry.reactNavigationIntegration();

Sentry.init({
  dsn: "https://cb0706e986b2d0d2479b9c3d1c655367@o4509722116882432.ingest.de.sentry.io/4512246808903760",
  // Crash reporting is only useful for real builds; keep dev noise out.
  enabled: !__DEV__,
  // Farmers' personal data stays out of events unless set explicitly.
  sendDefaultPii: false,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    navigationIntegration,
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],
});

void SplashScreen.preventAutoHideAsync();

SplashScreen.setOptions({
  duration: 400,
  fade: true,
});

function RootLayout() {
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    if (navigationRef) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

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

// Any screen that throws while rendering shows this instead of a blank app.
export { CrashScreen as ErrorBoundary };

export default Sentry.wrap(RootLayout);
