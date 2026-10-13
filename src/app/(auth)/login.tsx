import { isAxiosError } from "axios";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AuthScreenLayout } from "../../components/auth/AuthScreenLayout";
import { useAuth } from "../../context/AuthContext";
import { useSingleFlight } from "../../hooks/useSingleFlight";
import apiClient from "../../services/api/client";
import { getErrorMessage as getSharedErrorMessage } from "../../services/api/errors";
import { AuthUser } from "../../services/storage/authStorage";
import { useTheme } from "../../theme";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown;
};

type LoginResponse = {
  access: string;
  refresh: string;
  user: AuthUser;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return getSharedErrorMessage(error, fallback);
}

export default function LoginScreen() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);
  const singleFlight = useSingleFlight();

  const submit = () => singleFlight(async () => {
    setError("");
    if (!/^\d{10}$/.test(mobileNumber)) {
      setError(t("auth.invalidMobile"));
      return;
    }
    if (!password) {
      setError(t("auth.passwordRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<ApiEnvelope<LoginResponse>>(
        "/api/v1/auth/login/",
        { mobile_number: `+91${mobileNumber}`, password },
      );
      const data = response.data.data;
      console.log("Login response:", JSON.stringify(response.data, null, 2));

      if (
        !response.data.success ||
        !data?.access ||
        !data.refresh ||
        !data.user
      ) {
        throw new Error(response.data.message || t("auth.loginFailed"));
      }

      await login(data);
    } catch (loginError: unknown) {
      if (isAxiosError(loginError)) {
        console.log(
          "Login error response:",
          loginError.response?.status,
          JSON.stringify(loginError.response?.data, null, 2),
        );
      }
      if (isAxiosError(loginError) && loginError.response?.status === 403) {
        setError(t("auth.accountInactive"));
      } else {
        setError(getErrorMessage(loginError, t("auth.loginFailed")));
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthScreenLayout>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        {t("auth.loginTitle")}
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        {t("auth.loginSubtitle")}
      </Text>

      <Text style={[styles.label, { color: theme.colors.text }]}>
        {t("auth.mobileNumber")}
      </Text>
      <View
        style={[
          styles.mobileInput,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        ]}
      >
        <Text
          style={[
            styles.countryCode,
            {
              borderRightColor: theme.colors.border,
              color: theme.colors.textSecondary,
            },
          ]}
        >
          +91
        </Text>
        <TextInput
          accessibilityLabel={t("auth.mobileNumber")}
          autoComplete="tel-national"
          editable={!isSubmitting}
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={(value) => {
            setMobileNumber(value.replace(/\D/g, "").slice(0, 10));
            setError("");
          }}
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          placeholder={t("auth.mobilePlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="next"
          style={[styles.mobileText, { color: theme.colors.text }]}
          value={mobileNumber}
        />
      </View>

      <Text style={[styles.label, { color: theme.colors.text }]}>
        {t("auth.password")}
      </Text>
      <View
        style={[
          styles.passwordField,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <TextInput
          ref={passwordInputRef}
          accessibilityLabel={t("auth.password")}
          autoCapitalize="none"
          autoComplete="current-password"
          autoCorrect={false}
          editable={!isSubmitting}
          onChangeText={(value) => {
            setPassword(value);
            setError("");
          }}
          onSubmitEditing={submit}
          placeholder={t("auth.passwordPlaceholder")}
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="done"
          secureTextEntry={!showPassword}
          style={[styles.passwordInput, { color: theme.colors.text }]}
          value={password}
        />
        <Pressable
          accessibilityLabel={t(showPassword ? "auth.hidePassword" : "auth.showPassword")}
          accessibilityRole="button"
          accessibilityState={{ checked: showPassword }}
          disabled={isSubmitting}
          hitSlop={8}
          onPress={() => setShowPassword((visible) => !visible)}
          style={styles.eyeButton}
        >
          <SymbolView
            name={{
              ios: showPassword ? "eye.slash" : "eye",
              android: showPassword ? "visibility_off" : "visibility",
              web: showPassword ? "visibility_off" : "visibility",
            }}
            size={22}
            tintColor={theme.colors.textSecondary}
            accessible={false}
          />
        </Pressable>
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: theme.colors.error }]}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={submit}
        style={[
          styles.submitButton,
          {
            backgroundColor: theme.colors.primary,
            opacity: isSubmitting ? 0.7 : 1,
          },
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <Text style={[styles.submitText, { color: theme.colors.onPrimary }]}>
            {t("auth.signIn")}
          </Text>
        )}
      </Pressable>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
          {t("auth.newHere")}
        </Text>
        <Link href="/(auth)/signup" asChild>
          <Pressable accessibilityRole="link" disabled={isSubmitting}>
            <Text style={[styles.link, { color: theme.colors.text }]}>
              {t("auth.createAccount")}
            </Text>
          </Pressable>
        </Link>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  passwordField: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    height: 54,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  eyeButton: {
    marginLeft: 8,
    padding: 2,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 30,
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  mobileInput: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    height: 54,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  countryCode: {
    borderRightWidth: 1,
    borderRightColor: "#D1D5DB",
    fontSize: 15,
    fontWeight: "600",
    marginRight: 12,
    paddingRight: 12,
  },
  mobileText: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    height: 54,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  error: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  submitButton: {
    alignItems: "center",
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    marginTop: 8,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: 28,
  },
  footerText: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
