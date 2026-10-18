import { router, useIsFocused } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { DETAILS_SHEET_DETENTS } from "../../components/location/utils";
import { useBrandColors } from "../../components/location/useBrandColors";
import { useLocationFlow } from "../../context/LocationContext";
import { useTheme } from "../../theme";

const PIN_SIZE = 44;

export default function LocationMapScreen() {
  const { theme } = useTheme();
  const { brand } = useBrandColors();
  const { t } = useTranslation();
  const { pin, setPinCoordinate, current, services, clearReturnTo } =
    useLocationFlow();
  const { colors } = theme;
  const { height } = useWindowDimensions();
  // Bottom part of the map hidden by the delivery-details sheet.
  const sheetCover = height * DETAILS_SHEET_DETENTS[0];

  const mapRef = useRef<MapView | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState("");

  // Region the map opens on; later pin moves must not re-centre the map.
  const [initialRegion] = useState<Region>(() => {
    const delta = pin.isPrecise ? 0.004 : 5;
    return { ...pin.coordinate, latitudeDelta: delta, longitudeDelta: delta };
  });

  // The delivery-details form sheet slides up over the map as soon as the map
  // opens and cannot be swiped away. If it is dismissed anyway (Android back
  // button, the back arrow), the map is not usable without it, so leave too.
  useEffect(() => {
    router.push("/(protected)/delivery-details");
  }, []);

  // Leaving the map without saving must not send a later, unrelated location
  // choice back to the screen that opened it.
  useEffect(() => clearReturnTo, [clearReturnTo]);

  const isFocused = useIsFocused();
  const sheetHasOpened = useRef(false);
  useEffect(() => {
    if (!isFocused) {
      sheetHasOpened.current = true;
    } else if (sheetHasOpened.current && router.canGoBack()) {
      router.back();
    }
  }, [isFocused]);

  // `promptIfOff` is for the farmer's own tap; the automatic fix on open stays
  // quiet so the "turn on location" sheet doesn't pop up on every map visit.
  const goToCurrentLocation = async (promptIfOff = false) => {
    setIsLocating(true);
    setError("");
    const result = await current.locate();
    setIsLocating(false);

    if (result.ok) {
      mapRef.current?.animateToRegion(
        { ...result.coordinate, latitudeDelta: 0.004, longitudeDelta: 0.004 },
        400,
      );
    } else if (result.reason === "permission") {
      setError(t("location.permissionDenied"));
    } else if (result.reason === "services") {
      // On a tap, the "turn on location" sheet explains it; no inline message.
      if (promptIfOff) {
        services.showPrompt();
      } else {
        setError(t("location.servicesDisabled"));
      }
    } else {
      setError(t("location.currentUnavailable"));
    }
  };

  // Opening the map to add an address starts on the farmer's real position:
  // refine the cached starting point with a fresh GPS fix.
  const hasAutoLocated = useRef(false);
  useEffect(() => {
    if (hasAutoLocated.current) {
      return;
    }
    hasAutoLocated.current = true;
    void goToCurrentLocation();
    // Runs once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <MapView
        ref={mapRef}
        initialRegion={initialRegion}
        mapPadding={{ top: 0, left: 0, right: 0, bottom: sheetCover }}
        onRegionChangeComplete={(region) =>
          setPinCoordinate({
            latitude: region.latitude,
            longitude: region.longitude,
          })
        }
        pitchEnabled={false}
        provider={PROVIDER_GOOGLE}
        rotateEnabled={false}
        showsMyLocationButton={false}
        showsUserLocation={current.isGranted}
        style={StyleSheet.absoluteFill}
        toolbarEnabled={false}
      />

      <View
        pointerEvents="none"
        style={[styles.pinLayer, { bottom: (height + sheetCover) / 2 }]}
      >
        <View style={[styles.tooltip, { backgroundColor: colors.text }]}>
          <Text style={[styles.tooltipText, { color: colors.background }]}>
            {t("location.movePin")}
          </Text>
        </View>
        <SymbolView
          name={{
            ios: "mappin.and.ellipse",
            android: "location_on",
            web: "location_on",
          }}
          size={PIN_SIZE}
          tintColor={brand}
          accessible={false}
        />
      </View>

      <SafeAreaView edges={["top"]} style={styles.topBar} pointerEvents="box-none">
        <Pressable
          accessibilityLabel={t("location.back")}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={[
            styles.roundButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <SymbolView
            name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
            size={22}
            tintColor={colors.text}
            accessible={false}
          />
        </Pressable>
      </SafeAreaView>

      <View
        pointerEvents="box-none"
        style={[styles.bottomBar, { bottom: sheetCover + 12 }]}
      >
        {error ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { backgroundColor: colors.surface, color: colors.error }]}
          >
            {error}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isLocating}
            onPress={() => void goToCurrentLocation(true)}
            style={[
              styles.pill,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {isLocating ? (
              <ActivityIndicator color={brand} size="small" />
            ) : (
              <SymbolView
                name={{ ios: "scope", android: "my_location", web: "my_location" }}
                size={18}
                tintColor={brand}
                accessible={false}
              />
            )}
            <Text style={[styles.pillText, { color: brand }]}>
              {isLocating ? t("location.gettingLocation") : t("location.useCurrent")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pinLayer: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  tooltip: {
    borderRadius: 10,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tooltipText: { fontSize: 13, fontWeight: "600" },
  topBar: { left: 16, position: "absolute", top: 0 },
  roundButton: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginTop: 8,
    width: 44,
  },
  bottomBar: { gap: 8, left: 0, position: "absolute", right: 0 },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  pill: {
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    height: 42,
    paddingHorizontal: 16,
  },
  pillText: { fontSize: 14, fontWeight: "700" },
  error: {
    alignSelf: "center",
    borderRadius: 10,
    fontSize: 13,
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
