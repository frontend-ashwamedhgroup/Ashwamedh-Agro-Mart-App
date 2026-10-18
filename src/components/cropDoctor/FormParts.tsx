import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme";

/** Labelled form row with an optional hint and an inline error. */
export function Field({
  label,
  hint,
  error,
  warning,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  warning?: string | null;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.text }]}>
        {label}
      </Text>
      {children}
      {hint && !error ? (
        <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{hint}</Text>
      ) : null}
      {warning && !error ? (
        <Text style={[styles.hint, { color: theme.colors.warning }]}>{warning}</Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={[styles.hint, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? theme.colors.onPrimary : theme.colors.text,
          fontSize: 14,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: "700" },
  hint: { fontSize: 12, lineHeight: 17 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
});
