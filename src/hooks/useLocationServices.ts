import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

/**
 * Tracks the device-wide location switch (GPS on/off), which is separate from
 * this app's location permission (see useLocationPermission).
 *
 * `isEnabled` is null until the first check finishes. It is re-checked each
 * time the app returns to the foreground, so turning location on from the
 * system settings is picked up when the farmer comes back.
 */
export function useLocationServices(enabled = true) {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);

  const refresh = useCallback(
    () =>
      Location.hasServicesEnabledAsync()
        .then((next) => {
          setIsEnabled(next);
          return next;
        })
        .catch((error: unknown) => {
          console.warn("Failed to check location services:", error);
          return null;
        }),
    [],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void refresh();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
      }
    });

    return () => subscription.remove();
  }, [enabled, refresh]);

  /** Opens the system location switch (Android) or the app's settings (iOS). */
  const openSettings = useCallback(async () => {
    try {
      if (Platform.OS === "android") {
        await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
      } else {
        await Linking.openSettings();
      }
    } catch (error: unknown) {
      console.warn("Failed to open location settings:", error);
      await Linking.openSettings().catch(() => undefined);
    }
  }, []);

  return { isEnabled: enabled ? isEnabled : null, refresh, openSettings };
}
