import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AuthScreenLayout } from "../../components/auth/AuthScreenLayout";
import { useLanguage } from "../../context/LanguageContext";
import { SupportedLanguage, SUPPORTED_LANGUAGES } from "../../i18n";
import { useTheme } from "../../theme";

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  mr: "मराठी",
  hi: "हिन्दी",
};

export default function LanguageScreen() {
  const { language, changeLanguage } = useLanguage();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedLanguage>(language);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const continueToLogin = async () => {
    setIsSaving(true);
    setError("");
    try {
      await changeLanguage(selectedLanguage);
      router.replace("/(auth)/login");
    } catch (languageError: unknown) {
      console.error("Failed to save language selection:", languageError);
      setError(t("auth.languageError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthScreenLayout>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Choose your language
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        भाषा चुनें · भाषा निवडा
      </Text>

      <View style={styles.options}>
        {SUPPORTED_LANGUAGES.map((option) => {
          const selected = selectedLanguage === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setSelectedLanguage(option)}
              style={[
                styles.option,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: selected
                    ? theme.colors.primary
                    : theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.optionLabel, { color: theme.colors.text }]}>
                {LANGUAGE_LABELS[option]}
              </Text>
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: selected
                      ? theme.colors.primary
                      : theme.colors.border,
                    backgroundColor: selected
                      ? theme.colors.primary
                      : "transparent",
                  },
                ]}
              >
                {selected ? (
                  <View
                    style={[
                      styles.radioDot,
                      { backgroundColor: theme.colors.onPrimary },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.error, { color: theme.colors.error }]}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={continueToLogin}
        style={[
          styles.continueButton,
          {
            backgroundColor: theme.colors.primary,
            opacity: isSaving ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[styles.continueLabel, { color: theme.colors.onPrimary }]}>
          Continue
        </Text>
      </Pressable>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    marginBottom: 28,
    textAlign: "center",
  },
  options: {
    gap: 12,
  },
  option: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 60,
    paddingHorizontal: 18,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  radio: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  radioDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  continueButton: {
    alignItems: "center",
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    marginTop: 24,
  },
  continueLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
