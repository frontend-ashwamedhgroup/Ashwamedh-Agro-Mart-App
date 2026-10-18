/**
 * Bottom sheet shown when the phone's location switch is off.
 * Driven by LocationContext, which decides when it is visible.
 */

import { SymbolView } from "expo-symbols";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../theme";
import { useBrandColors } from "./useBrandColors";

type Props = {
  visible: boolean;
  onOpenSettings: () => void;
  onDismiss: () => void;
};

export default function LocationServicesModal({
  visible,
  onOpenSettings,
  onDismiss,
}: Props) {
  const { theme } = useTheme();
  const { brand, brandSoft, onBrand } = useBrandColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = theme;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={[styles.iconBubble, { backgroundColor: brandSoft }]}>
            <SymbolView
              name={{
                ios: "location.slash",
                android: "location_off",
                web: "location_off",
              }}
              size={28}
              tintColor={brand}
              accessible={false}
            />
          </View>

          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            {t("location.servicesOffTitle")}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {t("location.servicesOffMessage")}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: brand, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.primaryText, { color: onBrand }]}>
              {t("location.openSettings")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.secondary,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>
              {t("location.servicesOffLater")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    alignItems: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  iconBubble: {
    alignItems: "center",
    borderRadius: 32,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  title: { fontSize: 20, fontWeight: "800", marginTop: 6, textAlign: "center" },
  message: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  primary: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: 14,
    marginTop: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  primaryText: { fontSize: 15, fontWeight: "700" },
  secondary: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    minHeight: 44,
  },
  secondaryText: { fontSize: 14, fontWeight: "600" },
});
