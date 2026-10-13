import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme";

type Props = {
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
};

export function QuantityStepper({ value, min = 1, max = 999, disabled, onChange }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const button = (label: string, a11y: string, next: number, off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: off }}
      disabled={off}
      hitSlop={6}
      onPress={() => onChange(next)}
      style={[styles.button, { opacity: off ? 0.35 : 1 }]}
    >
      <Text style={[styles.glyph, { color: theme.colors.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.wrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
      {button("−", t("shopping.decrease"), value - 1, disabled || value <= min)}
      <Text accessibilityLabel={t("shopping.quantity")} style={[styles.value, { color: theme.colors.text }]}>
        {value}
      </Text>
      {button("+", t("shopping.increase"), value + 1, disabled || value >= max)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", height: 44 },
  button: { alignItems: "center", height: 44, justifyContent: "center", width: 40 },
  glyph: { fontSize: 20, fontWeight: "600" },
  value: { fontSize: 15, fontWeight: "700", minWidth: 24, textAlign: "center" },
});
