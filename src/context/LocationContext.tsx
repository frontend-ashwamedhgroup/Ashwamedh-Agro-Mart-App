/**
 * State shared by the delivery-location screens:
 *
 *   /location          pick current / saved / recent, or start a new address
 *   /location-map      move the pin on the map
 *   /delivery-details  scrollable form sheet over the map to save the address
 *
 * Lives in the (protected) layout so the header button, the three screens and
 * the reverse-geocoding of the pin all see the same data.
 */

import * as Location from "expo-location";
import { router } from "expo-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";

import {
  loadRecentSelections,
  loadSelection,
  saveSelection,
} from "../components/location/storage";
import type {
  AddressDraft,
  Coordinate,
  LocationSelection,
} from "../components/location/types";
import {
  applyGeocodedAddress,
  EMPTY_DRAFT,
  getPlaceSubtitle,
  getPlaceTitle,
  INDIA_CENTER,
} from "../components/location/utils";
import { useCurrentLocation } from "../hooks/useCurrentLocation";
import { useFarmerAddresses } from "../hooks/useFarmerAddresses";

const REVERSE_GEOCODE_DELAY_MS = 500;

export type Pin = {
  coordinate: Coordinate;
  /** True for a real fix; false for the country-wide fallback view. */
  isPrecise: boolean;
};

type PinPlace = {
  title: string;
  subtitle: string;
  failed: boolean;
};

type LocationContextType = {
  selection: LocationSelection | null;
  recent: LocationSelection[];
  addresses: ReturnType<typeof useFarmerAddresses>;
  current: ReturnType<typeof useCurrentLocation>;
  isFirstAddress: boolean;

  /** Saves the choice as the browsing location and closes the whole flow. */
  chooseLocation: (next: LocationSelection) => Promise<void>;
  /** Starts the map flow at `coordinate`, or at the best guess if omitted. */
  openMap: (coordinate?: Coordinate) => Promise<void>;

  pin: Pin;
  setPinCoordinate: (coordinate: Coordinate) => void;
  place: PinPlace;
  isResolving: boolean;
  draft: AddressDraft;
  updateDraft: <K extends keyof AddressDraft>(
    key: K,
    value: AddressDraft[K],
  ) => void;
};

const LocationContext = createContext<LocationContextType | null>(null);

const NO_PLACE: PinPlace = { title: "", subtitle: "", failed: false };

export function LocationProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const current = useCurrentLocation();
  const addresses = useFarmerAddresses();

  const [selection, setSelection] = useState<LocationSelection | null>(null);
  const [recent, setRecent] = useState<LocationSelection[]>([]);
  const [pin, setPin] = useState<Pin>({
    coordinate: INDIA_CENTER,
    isPrecise: false,
  });
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT);
  const [place, setPlace] = useState<PinPlace>(NO_PLACE);
  // The pin position whose address has been looked up; differs from
  // `pin.coordinate` while a lookup is pending.
  const [resolvedCoordinate, setResolvedCoordinate] =
    useState<Coordinate | null>(null);

  useEffect(() => {
    let isMounted = true;

    void Promise.all([loadSelection(), loadRecentSelections()]).then(
      ([storedSelection, storedRecent]) => {
        if (isMounted) {
          setSelection(storedSelection);
          setRecent(storedRecent);
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, []);

  // This provider only mounts for a signed-in farmer, so this asks once per
  // session: on app start when already logged in, or right after login. Skipped
  // if the farmer already answered (granted, or denied and can't be asked again).
  const { status, canAskAgain, requestPermission } = current;
  const hasAskedForPermission = useRef(false);

  useEffect(() => {
    if (
      hasAskedForPermission.current ||
      status === null ||
      status === "granted" ||
      !canAskAgain
    ) {
      return;
    }

    hasAskedForPermission.current = true;
    void requestPermission();
  }, [status, canAskAgain, requestPermission]);

  // Resolve the pin to an address shortly after it stops moving.
  useEffect(() => {
    if (!pin.isPrecise) {
      return;
    }

    const { coordinate } = pin;
    let cancelled = false;

    const timer = setTimeout(async () => {
      let nextPlace: Location.LocationGeocodedAddress | null = null;
      let failed = false;

      try {
        [nextPlace = null] = await Location.reverseGeocodeAsync(coordinate);
        failed = !nextPlace;
      } catch (error: unknown) {
        console.warn("Reverse geocoding failed:", error);
        failed = true;
      }

      if (cancelled) {
        return;
      }
      setPlace({
        title: getPlaceTitle(nextPlace),
        subtitle: getPlaceSubtitle(nextPlace),
        failed,
      });
      setDraft((currentDraft) => applyGeocodedAddress(currentDraft, nextPlace));
      setResolvedCoordinate(coordinate);
    }, REVERSE_GEOCODE_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pin]);

  const chooseLocation = useCallback(
    async (next: LocationSelection) => {
      try {
        const nextRecent = await saveSelection(next, recent);
        setSelection(next);
        router.dismissAll();
        // Reorder the list only after the modal is on its way out. Doing it
        // before re-renders the sheet mid-dismiss (a tapped recent item moves
        // to the top, remounting rows), which can leave a blank screen.
        setTimeout(() => setRecent(nextRecent), 400);
      } catch (error: unknown) {
        console.error("Failed to save browsing location:", error);
        Alert.alert(t("location.locationError"));
      }
    },
    [recent, t],
  );

  const openMap = useCallback(
    async (coordinate?: Coordinate) => {
      let point = coordinate;

      if (!point) {
        // "Add new address": centre on the farmer if we can, else on the last
        // chosen place, else on India.
        const located = await current.locate();
        point = located.ok ? located.coordinate : selection?.coordinate;
      }

      setDraft(EMPTY_DRAFT);
      setPlace(NO_PLACE);
      setResolvedCoordinate(null);
      setPin(
        point
          ? { coordinate: point, isPrecise: true }
          : { coordinate: INDIA_CENTER, isPrecise: false },
      );
      router.push("/(protected)/location-map");
    },
    [current, selection?.coordinate],
  );

  const setPinCoordinate = useCallback((coordinate: Coordinate) => {
    setPin((currentPin) => ({ ...currentPin, coordinate, isPrecise: true }));
  }, []);

  const updateDraft = useCallback(
    <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) => {
      setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    },
    [],
  );

  const isResolving = pin.isPrecise && resolvedCoordinate !== pin.coordinate;
  const isFirstAddress =
    !addresses.isLoading &&
    addresses.error === null &&
    addresses.addresses.length === 0;

  const value = useMemo<LocationContextType>(
    () => ({
      selection,
      recent,
      addresses,
      current,
      isFirstAddress,
      chooseLocation,
      openMap,
      pin,
      setPinCoordinate,
      place,
      isResolving,
      draft,
      updateDraft,
    }),
    [
      selection,
      recent,
      addresses,
      current,
      isFirstAddress,
      chooseLocation,
      openMap,
      pin,
      setPinCoordinate,
      place,
      isResolving,
      draft,
      updateDraft,
    ],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationFlow(): LocationContextType {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error("useLocationFlow must be used within LocationProvider");
  }

  return context;
}
