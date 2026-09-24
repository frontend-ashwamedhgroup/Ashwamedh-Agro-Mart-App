// Login page for authentication, language selection, and theme-aware form display.
import { useRef, useState } from "react";

import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import {
  KeyboardAwareScrollView,
  KeyboardToolbar,
} from "react-native-keyboard-controller";

import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import apiClient from "../../services/api/client";

import { SUPPORTED_LANGUAGES, SupportedLanguage } from "../../i18n";

import { useTheme } from "../../theme";

type LoginResponse = {
  status: boolean;
  message?: string;
  data?: {
    access?: string;
    refresh?: string;
    user_name?: string;
  };
};

type ErrorResponse = {
  message?: string;
};

export default function LoginScreen() {
  const { login } = useAuth();
  const { language: currentLanguage, changeLanguage } = useLanguage();
  const { theme, mode, setMode } = useTheme();
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError("");

    const normalizedUsername = username.trim();

    if (!normalizedUsername || !password) {
      setError(t("login.requiredFields"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post<LoginResponse>("/auth/login/", {
        username: normalizedUsername,
        password,
      });

      const data = response.data;

      if (
        !data.status ||
        !data.data?.access ||
        !data.data.refresh ||
        !data.data.user_name
      ) {
        throw new Error(data.message || t("login.invalidCredentials"));
      }

      const tokenData = {
        access: data.data.access,
        refresh: data.data.refresh,
        user_name: data.data.user_name,
      };

      await login(tokenData);
    } catch (loginError: unknown) {
      if (isAxiosError<ErrorResponse>(loginError)) {
        setError(
          loginError.response?.data?.message ||
            loginError.message ||
            t("login.invalidCredentials"),
        );
      } else {
        setError(
          loginError instanceof Error
            ? loginError.message
            : t("login.invalidCredentials"),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLanguageChange = async (language: SupportedLanguage) => {
    if (isSubmitting) {
      return;
    }

    try {
      setError("");
      await changeLanguage(language);
    } catch (languageError) {
      console.error("Failed to change language:", languageError);
    }
  };

  return (
    <>
      <KeyboardToolbar />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.container,
            {
              backgroundColor: theme.colors.background,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text
              style={[
                styles.title,
                {
                  color: theme.colors.text,
                },
              ]}
            >
              Ashwamedh Agro Mart
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color: theme.colors.textSecondary,
                },
              ]}
            >
              {t("login.welcome")}
            </Text>

            <View style={styles.themeRow}>
              <Text
                style={[
                  styles.themeLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {t("login.darkMode")}
              </Text>
              <Switch
                value={mode === "dark"}
                disabled={isSubmitting}
                onValueChange={(enabled) => setMode(enabled ? "dark" : "light")}
                trackColor={{
                  false: theme.colors.border,
                  true: theme.colors.primary,
                }}
                thumbColor={theme.colors.surface}
              />
            </View>

            <View style={styles.languageContainer}>
              {SUPPORTED_LANGUAGES.map((language) => {
                const isSelected = currentLanguage === language;

                return (
                  <TouchableOpacity
                    key={language}
                    activeOpacity={0.7}
                    onPress={() => handleLanguageChange(language)}
                    disabled={isSubmitting}
                    style={[
                      styles.languageButton,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.surface,

                        borderColor: theme.colors.border,

                        opacity: isSubmitting ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.languageText,
                        {
                          color: isSelected
                            ? theme.colors.onPrimary
                            : theme.colors.text,
                        },
                      ]}
                    >
                      {language.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder={t("login.username")}
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!isSubmitting}
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  opacity: isSubmitting ? 0.7 : 1,
                  borderRadius: theme.radius.md,
                },
              ]}
            />

            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder={t("login.password")}
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              editable={!isSubmitting}
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  opacity: isSubmitting ? 0.7 : 1,
                  borderRadius: theme.radius.md,
                },
              ]}
            />

            {error ? (
              <Text
                style={[
                  styles.error,
                  {
                    color: theme.colors.error,
                  },
                ]}
              >
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.button,
                {
                  backgroundColor: theme.colors.primary,

                  opacity: isSubmitting ? 0.7 : 1,
                },
              ]}
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={theme.colors.onPrimary} />
              ) : (
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color: theme.colors.onPrimary,
                    },
                  ]}
                >
                  {t("login.login")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },

  content: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },

  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  themeLabel: {
    fontSize: 14,
  },

  languageContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },

  languageButton: {
    minWidth: 52,
    height: 38,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  languageText: {
    fontSize: 12,
    fontWeight: "600",
  },

  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 16,
  },

  button: {
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },

  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },

  error: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
});
