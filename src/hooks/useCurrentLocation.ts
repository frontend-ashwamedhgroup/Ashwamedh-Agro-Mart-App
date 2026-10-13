import * as Location from "expo-location";
import { useCallback, useState } from "react";

import type { Coordinate } from "../components/location/types";
import { useLocationPermission } from "./useLocationPermission";

export type CurrentLocationFailure =
  | "permission"
  | "services"
  | "unavailable";

type CurrentLocationResult =
  | { ok: true; coordinate: Coordinate }
  | { ok: false; reason: CurrentLocationFailure };

/**
 * Wraps useLocationPermission with the "give me the device position" flow:
 * permission -> services check -> GPS fix.
 */
export function useCurrentLocation() {
  const permission = useLocationPermission(true);
  const [isLocating, setIsLocating] = useState(false);
  const { isGranted, requestPermission } = permission;

  const ensurePermission = useCallback(async () => {
    if (isGranted) {
      return true;
    }
    return (await requestPermission()).granted;
  }, [isGranted, requestPermission]);

  const locate = useCallback(async (): Promise<CurrentLocationResult> => {
    setIsLocating(true);

    try {
      if (!(await ensurePermission())) {
        return { ok: false, reason: "permission" };
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        return { ok: false, reason: "services" };
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        ok: true,
        coordinate: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
      };
    } catch (error: unknown) {
      console.warn("Could not get the current position:", error);
      return { ok: false, reason: "unavailable" };
    } finally {
      setIsLocating(false);
    }
  }, [ensurePermission]);

  return { ...permission, isLocating, ensurePermission, locate };
}
