import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme";

type ComingSoonScreenProps = {
  title: string;
  description: string;
  backLabel?: string;
  onBack?: () => void;
};

export function ComingSoonScreen({
  title,
  description,
  backLabel,
  onBack,
}: ComingSoonScreenProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[
        styles.screen,
        { backgroundColor: theme.colors.background },
        onBack && styles.screenWithBack,
      ]}
    >
      {onBack && backLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={[styles.backLabel, { color: theme.colors.primary }]}>
            ‹ {backLabel}
          </Text>
        </Pressable>
      ) : null}
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
          {description}
        </Text>
        <Text style={[styles.status, { color: theme.colors.textMuted }]}>
          This section is coming soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  screenWithBack: { justifyContent: "flex-start" },
  backButton: {
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 12,
  },
  backLabel: { fontSize: 16, fontWeight: "600" },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    lineHeight: 23,
  },
  status: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 20,
  },
});
