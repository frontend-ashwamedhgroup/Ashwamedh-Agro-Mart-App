// Marathi / English switch for the diagnosis result.
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DiagnosisLanguage } from "../../services/cropDoctor/types";
import { useTheme } from "../../theme";

/** Language names are written in their own script so either reader finds theirs. */
const LANGUAGE_NAMES: Record<DiagnosisLanguage, string> = { mr: "मराठी", en: "English" };
export function LanguageToggle({
  languages,
  value,
  onChange,
}: {
  languages: DiagnosisLanguage[];
  value: DiagnosisLanguage;
  onChange: (language: DiagnosisLanguage) => void;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={t("cropDoctor.resultLanguage")}
      accessibilityRole="radiogroup"
      style={[styles.toggle, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
    >
      {languages.map((language) => {
        const selected = language === value;
        return (
          <Pressable
            key={language}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(language)}
            style={[styles.option, selected && { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.text, { color: selected ? theme.colors.onPrimary : theme.colors.textSecondary }]}>
              {LANGUAGE_NAMES[language]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { alignSelf: "flex-end", borderRadius: 20, borderWidth: 1, flexDirection: "row", padding: 3 },
  option: { borderRadius: 17, justifyContent: "center", minHeight: 34, minWidth: 76, paddingHorizontal: 14 },
  text: { fontSize: 14, fontWeight: "700", textAlign: "center" },
});
