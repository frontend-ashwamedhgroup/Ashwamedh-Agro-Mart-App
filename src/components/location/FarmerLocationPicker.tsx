/**
 * Header button that shows the active delivery location and opens the
 * location flow (see LocationContext for the screens involved).
 */

import * as Location from "expo-location";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";

import { useLocationFlow } from "../../context/LocationContext";
import { useTheme } from "../../theme";
import { getPlaceSubtitle, joinParts } from "./utils";
import { useBrandColors } from "./useBrandColors";

export default function FarmerLocationPicker() {
  const { theme } = useTheme();
  const { brand } = useBrandColors();
  const { t } = useTranslation();
  const { selection, current, services } = useLocationFlow();
  const { colors } = theme;
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const { isGranted, locate } = current;
  const servicesOff = services.isEnabled === false;

  // Display only: with nothing chosen yet, show where the farmer is right now.
  // This is never saved as the browsing location. Re-runs when the phone's
  // location switch is turned on, since permission alone doesn't change then.
  useEffect(() => {
    if (selection || !isGranted || servicesOff) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const located = await locate();
      if (!located.ok || cancelled) {
        return;
      }

      try {
        const [place = null] = await Location.reverseGeocodeAsync(
          located.coordinate,
        );
        const label =
          joinParts([place?.name, place?.district, place?.city]) ||
          getPlaceSubtitle(place);
        if (!cancelled && label) {
          setDeviceLabel(label);
        }
      } catch (error: unknown) {
        console.warn("Reverse geocoding the current location failed:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `locate` changes identity with permission state; only re-run on grant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, isGranted, servicesOff]);

  const displayLabel =
    selection?.label ??
    (servicesOff ? t("location.turnOnLocation") : deviceLabel) ??
    t("location.chooseLocation");

  return (
    <Pressable
      accessibilityHint={t("location.changeLocation")}
      accessibilityLabel={displayLabel}
      accessibilityRole="button"
      onPress={() => router.push("/(protected)/location")}
      style={({ pressed }) => [styles.trigger, { opacity: pressed ? 0.6 : 1 }]}
    >
      <SymbolView
        name={{
          ios: "mappin.and.ellipse",
          android: "location_on",
          web: "location_on",
        }}
        size={18}
        tintColor={brand}
        accessible={false}
      />
      <Text
        numberOfLines={1}
        style={[styles.triggerText, { color: colors.textSecondary }]}
      >
        {displayLabel}
      </Text>
      <SymbolView
        name={{
          ios: "chevron.down",
          android: "expand_more",
          web: "expand_more",
        }}
        size={14}
        tintColor={colors.textMuted}
        accessible={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 6,
    maxWidth: "100%",
    minHeight: 32,
  },
  triggerText: { flexShrink: 1, fontSize: 14, fontWeight: "600" },
});
