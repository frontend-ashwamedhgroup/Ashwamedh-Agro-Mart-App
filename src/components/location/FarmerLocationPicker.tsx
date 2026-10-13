/**
 * Header button that shows the active delivery location and opens the
 * location flow (see LocationContext for the screens involved).
 */

import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";

import { useLocationFlow } from "../../context/LocationContext";
import { useTheme } from "../../theme";
import { useBrandColors } from "./useBrandColors";

export default function FarmerLocationPicker() {
  const { theme } = useTheme();
  const { brand } = useBrandColors();
  const { t } = useTranslation();
  const { selection } = useLocationFlow();
  const { colors } = theme;

  return (
    <Pressable
      accessibilityHint={t("location.changeLocation")}
      accessibilityLabel={selection?.label ?? t("location.chooseLocation")}
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
        {selection?.label ?? t("location.chooseLocation")}
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
