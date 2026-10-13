import { isAxiosError } from "axios";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
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

const RESEND_COOLDOWN_SECONDS = 60;

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown;
};

type OtpRequestData = {
  request_id: string;
  expires_at: string;
};

type OtpVerifyData = {
  access: string;
  refresh: string;
  user: AuthUser;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return getSharedErrorMessage(error, fallback);
}

export default function SignupScreen() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpStep, setIsOtpStep] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  const singleFlight = useSingleFlight();

  const requestOtp = () => singleFlight(async () => {
    setError("");
    if (!isOtpStep) {
      if (!fullName.trim()) {
        setError(t("auth.nameRequired"));
        return;
      }
      if (!/^\d{10}$/.test(mobileNumber)) {
        setError(t("auth.invalidMobile"));
        return;
      }
      if (password.length < 8 || /^\d+$/.test(password)) {
        setError(t("auth.passwordRules"));
        return;
      }
      if (password !== passwordConfirm) {
        setError(t("auth.passwordMismatch"));
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<ApiEnvelope<OtpRequestData>>(
        "/api/v1/auth/otp/request/",
        {
          mobile_number: `+91${mobileNumber}`,
          full_name: fullName.trim(),
          password,
          password_confirm: passwordConfirm,
        },
      );
      const data = response.data.data;
      if (!response.data.success || !data?.request_id) {
        throw new Error(response.data.message || t("auth.otpRequestFailed"));
      }

      setRequestId(data.request_id);
      setOtp("");
      setIsOtpStep(true);
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch (requestError: unknown) {
      if (isAxiosError(requestError) && requestError.response?.status === 429) {
        setError(t("auth.tooManyRequests"));
      } else if (
        isAxiosError(requestError) &&
        requestError.response?.status === 503
      ) {
        setError(t("auth.otpUnavailable"));
      } else {
        setError(getErrorMessage(requestError, t("auth.otpRequestFailed")));
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  const verifyOtp = () => singleFlight(async () => {
    setError("");
    if (!requestId) {
      setIsOtpStep(false);
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError(t("auth.invalidOtp"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.post<ApiEnvelope<OtpVerifyData>>(
        "/api/v1/auth/otp/verify/",
        { request_id: requestId, otp },
      );
      const data = response.data.data;
      if (
        !response.data.success ||
        !data?.access ||
        !data.refresh ||
        !data.user
      ) {
        throw new Error(response.data.message || t("auth.signupFailed"));
      }
      await login(data);
    } catch (verifyError: unknown) {
      if (isAxiosError(verifyError) && verifyError.response?.status === 403) {
        setError(t("auth.accountInactive"));
      } else if (
        isAxiosError(verifyError) &&
        verifyError.response?.status === 429
      ) {
        setError(t("auth.tooManyRequests"));
      } else {
        setError(getErrorMessage(verifyError, t("auth.invalidOtp")));
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  const editDetails = () => {
    if (isSubmitting) return;
    setIsOtpStep(false);
    setRequestId(null);
    setOtp("");
    setResendSeconds(0);
    setError("");
  };

  const { colors } = theme;

  return (
    <AuthScreenLayout>
      <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
        {t("auth.signUpEyebrow")}
      </Text>
      <Text style={[styles.title, { color: colors.text }]}>
        {isOtpStep ? t("auth.verifyTitle") : t("auth.signupTitle")}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {isOtpStep
          ? t("auth.otpSentTo", { mobile: `+91 ${mobileNumber}` })
          : ""}
      </Text>

      {isOtpStep ? (
        <>
          <Text style={[styles.label, { color: colors.text }]}>
            {t("auth.otp")}
          </Text>
          <TextInput
            accessibilityLabel={t("auth.otp")}
            autoComplete="one-time-code"
            editable={!isSubmitting}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(value) => {
              setOtp(value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            onSubmitEditing={verifyOtp}
            placeholder={t("auth.otpPlaceholder")}
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            style={[
              styles.textInput,
              styles.otpInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={otp}
          />
          <View style={styles.otpActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={editDetails}
            >
              <Text style={[styles.link, { color: colors.textSecondary }]}>
                {t("auth.editDetails")}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting || resendSeconds > 0}
              onPress={requestOtp}
            >
              <Text
                style={[
                  styles.link,
                  { color: resendSeconds > 0 ? colors.textMuted : colors.text },
                ]}
              >
                {resendSeconds > 0
                  ? t("auth.resendIn", { seconds: resendSeconds })
                  : t("auth.resendOtp")}
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: colors.text }]}>
            {t("auth.fullName")}
          </Text>
          <TextInput
            accessibilityLabel={t("auth.fullName")}
            autoCapitalize="words"
            autoComplete="name"
            editable={!isSubmitting}
            onChangeText={(value) => {
              setFullName(value);
              setError("");
            }}
            placeholder={t("auth.fullNamePlaceholder")}
            placeholderTextColor={colors.textMuted}
            returnKeyType="next"
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={fullName}
          />

          <Text style={[styles.label, { color: colors.text }]}>
            {t("auth.mobileNumber")}
          </Text>
          <View
            style={[
              styles.mobileInput,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.countryCode,
                {
                  borderRightColor: colors.border,
                  color: colors.textSecondary,
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
              placeholder={t("auth.mobilePlaceholder")}
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              style={[styles.mobileText, { color: colors.text }]}
              value={mobileNumber}
            />
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {t("auth.password")}
          </Text>
          <View
            style={[
              styles.passwordField,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TextInput
              accessibilityLabel={t("auth.password")}
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
              editable={!isSubmitting}
              onChangeText={(value) => {
                setPassword(value);
                setError("");
              }}
              placeholder={t("auth.passwordPlaceholder")}
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
              secureTextEntry={!showPassword}
              style={[styles.passwordInput, { color: colors.text }]}
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
                tintColor={colors.textSecondary}
                accessible={false}
              />
            </Pressable>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {t("auth.confirmPassword")}
          </Text>
          <View
            style={[
              styles.passwordField,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TextInput
              accessibilityLabel={t("auth.confirmPassword")}
              autoCapitalize="none"
              autoComplete="new-password"
              autoCorrect={false}
              editable={!isSubmitting}
              onChangeText={(value) => {
                setPasswordConfirm(value);
                setError("");
              }}
            onSubmitEditing={requestOtp}
              placeholder={t("auth.confirmPasswordPlaceholder")}
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              secureTextEntry={!showConfirmPassword}
              style={[styles.passwordInput, { color: colors.text }]}
              value={passwordConfirm}
            />
            <Pressable
              accessibilityLabel={t(showConfirmPassword ? "auth.hidePassword" : "auth.showPassword")}
              accessibilityRole="button"
              accessibilityState={{ checked: showConfirmPassword }}
              disabled={isSubmitting}
              hitSlop={8}
              onPress={() => setShowConfirmPassword((visible) => !visible)}
              style={styles.eyeButton}
            >
              <SymbolView
                name={{
                  ios: showConfirmPassword ? "eye.slash" : "eye",
                  android: showConfirmPassword ? "visibility_off" : "visibility",
                  web: showConfirmPassword ? "visibility_off" : "visibility",
                }}
                size={22}
                tintColor={colors.textSecondary}
                accessible={false}
              />
            </Pressable>
          </View>
        </>
      )}

      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.error, { color: colors.error }]}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={isOtpStep ? verifyOtp : requestOtp}
        style={[
          styles.submitButton,
          { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 },
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={[styles.submitText, { color: colors.onPrimary }]}>
            {isOtpStep ? t("auth.verifyAndSignUp") : t("auth.sendOtp")}
          </Text>
        )}
      </Pressable>

      {!isOtpStep ? (
        <Text style={[styles.passwordHint, { color: colors.textMuted }]}>
          {t("auth.passwordRules")}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          {t("auth.haveAccount")}
        </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable accessibilityRole="link" disabled={isSubmitting}>
            <Text style={[styles.link, { color: colors.text }]}>
              {t("auth.signIn")}
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
    marginBottom: 18,
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
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
    textAlign: "center",
    textTransform: "uppercase",
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
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  countryCode: {
    borderRightColor: "#D1D5DB",
    borderRightWidth: 1,
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
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  otpInput: {
    fontSize: 22,
    letterSpacing: 10,
    marginBottom: 12,
    textAlign: "center",
  },
  otpActions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
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
  passwordHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: 26,
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
