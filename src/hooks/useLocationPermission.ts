import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";

type LocationPermissionResponse =
  Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>;

type RequestPermissionResult = {
  permission: LocationPermissionResponse | null;
  granted: boolean;
};

export function useLocationPermission(enabled = true) {
  const [permission, setPermission] =
    useState<LocationPermissionResponse | null>(null);

  const [isChecking, setIsChecking] = useState(false);

  const [isRequesting, setIsRequesting] = useState(false);

  const enabledRef = useRef(enabled);

  const checkPromiseRef = useRef<
    Promise<LocationPermissionResponse | null> | null
  >(null);

  /**
   * Check the current foreground location permission.
   *
   * This method does not display the native permission dialog.
   */
  const checkPermission = useCallback(() => {
    if (!enabledRef.current) {
      return Promise.resolve(null);
    }

    /**
     * Prevent multiple permission checks from running
     * at the same time.
     */
    if (checkPromiseRef.current) {
      return checkPromiseRef.current;
    }

    setIsChecking(true);

    const checkPromise = Location.getForegroundPermissionsAsync()
      .then((response) => {
        if (enabledRef.current) {
          setPermission(response);
        }

        return response;
      })
      .catch((error: unknown) => {
        console.error(
          "Failed to check foreground location permission:",
          error,
        );

        return null;
      })
      .finally(() => {
        if (enabledRef.current) {
          setIsChecking(false);
        }

        checkPromiseRef.current = null;
      });

    checkPromiseRef.current = checkPromise;

    return checkPromise;
  }, []);

  /**
   * Request foreground location permission.
   *
   * This may display the native Android/iOS permission dialog.
   */
  const requestPermission =
    useCallback(async (): Promise<RequestPermissionResult> => {
      if (!enabledRef.current) {
        return {
          permission: null,
          granted: false,
        };
      }

      setIsRequesting(true);

      try {
        const response =
          await Location.requestForegroundPermissionsAsync();

        if (enabledRef.current) {
          setPermission(response);
        }

        return {
          permission: response,
          granted: response.granted,
        };
      } catch (error: unknown) {
        console.error(
          "Failed to request foreground location permission:",
          error,
        );

        return {
          permission: null,
          granted: false,
        };
      } finally {
        if (enabledRef.current) {
          setIsRequesting(false);
        }
      }
    }, []);

  /**
   * Open the application settings.
   *
   * This is useful when the operating system does not allow
   * the application to request the permission again.
   */
  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch (error: unknown) {
      console.error(
        "Failed to open application settings:",
        error,
      );
    }
  }, []);

  useEffect(() => {
    enabledRef.current = enabled;

    if (!enabled) {
      return;
    }

    /**
     * Check the permission when the hook becomes active.
     */
    void checkPermission();

    /**
     * Re-check the permission when the application
     * returns to the foreground.
     *
     * This handles cases where the farmer changes
     * the location permission from device Settings.
     */
    const subscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") {
          void checkPermission();
        }
      },
    );

    return () => {
      enabledRef.current = false;
      subscription.remove();
    };
  }, [checkPermission, enabled]);

  const status = enabled
    ? permission?.status ?? null
    : null;

  const isGranted =
    enabled && (permission?.granted ?? false);

  const canAskAgain =
    enabled && (permission?.canAskAgain ?? true);

  return {
    /**
     * Complete Expo permission response.
     */
    permission: enabled ? permission : null,

    /**
     * Permission status.
     *
     * Possible values include:
     * - granted
     * - denied
     * - undetermined
     */
    status,

    /**
     * Whether foreground location permission is granted.
     */
    isGranted,

    /**
     * Whether the application can request
     * the permission again.
     */
    canAskAgain,

    /**
     * Whether permission status is currently being checked.
     */
    isChecking: enabled && isChecking,

    /**
     * Whether the permission request is currently running.
     */
    isRequesting: enabled && isRequesting,

    /**
     * Check the current permission without
     * displaying a permission dialog.
     */
    refreshPermission: checkPermission,

    /**
     * Request foreground location permission.
     */
    requestPermission,

    /**
     * Open Android/iOS application settings.
     */
    openSettings,
  };
}