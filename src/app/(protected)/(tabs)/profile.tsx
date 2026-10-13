import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProfileFieldsSkeleton } from "../../../components/skeleton/ProfileFieldsSkeleton";
import FarmerLocationPicker from "../../../components/location/FarmerLocationPicker";
import { useAuth } from "../../../context/AuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import type { SupportedLanguage } from "../../../i18n";
import { useSingleFlight } from "../../../hooks/useSingleFlight";
import apiClient from "../../../services/api/client";
import { getErrorMessage as getSharedErrorMessage } from "../../../services/api/errors";
import { useTheme } from "../../../theme";

type FarmerProfile = {
  id: number;
  mobile_number: string;
  email: string;
  full_name: string;
  created_at: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown;
};

type ProfileEnvelope = ApiEnvelope<{ profile: FarmerProfile }>;

const languageOptions: {
  value: SupportedLanguage;
  label: string;
}[] = [
  { value: "en", label: "English" },
  { value: "mr", label: "मराठी" },
  { value: "hi", label: "हिन्दी" },
];

function getErrorMessage(error: unknown, fallback: string): string {
  return getSharedErrorMessage(error, fallback);
}

function getInitials(name: string, mobileNumber: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return initials.toLocaleUpperCase() || mobileNumber.slice(-2) || "•";
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { theme, preference, setMode } = useTheme();
  const { language, changeLanguage } = useLanguage();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const singleFlight = useSingleFlight();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [preferenceError, setPreferenceError] = useState("");
  const [notice, setNotice] = useState("");

  const requestProfile = useCallback(async () => {
    const response = await apiClient.get<ProfileEnvelope>(
      "/api/v1/farmer/profile/",
    );
    const loadedProfile = response.data.data?.profile;

    if (!response.data.success || !loadedProfile) {
      throw new Error(response.data.message || t("account.loadError"));
    }

    return loadedProfile;
  }, [t]);

  const applyProfile = useCallback((loadedProfile: FarmerProfile) => {
    setErrorMessage("");
    setProfile(loadedProfile);
    setFullName(loadedProfile.full_name ?? "");
    setEmail(loadedProfile.email ?? "");
  }, []);

  useEffect(() => {
    let isMounted = true;

    requestProfile()
      .then((loadedProfile) => {
        if (isMounted) {
          applyProfile(loadedProfile);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error, t("account.loadError")));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [applyProfile, requestProfile, t]);

  const loadProfile = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      applyProfile(await requestProfile());
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, t("account.loadError")));
    } finally {
      setIsLoading(false);
    }
  };

  const beginEditing = () => {
    setFullName(profile?.full_name ?? "");
    setEmail(profile?.email ?? "");
    setErrorMessage("");
    setNotice("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setFullName(profile?.full_name ?? "");
    setEmail(profile?.email ?? "");
    setErrorMessage("");
    setIsEditing(false);
  };

  const saveProfile = () => singleFlight(async () => {
    setIsSaving(true);
    setErrorMessage("");
    setNotice("");

    try {
      const response = await apiClient.patch<ProfileEnvelope>(
        "/api/v1/farmer/profile/",
        {
          full_name: fullName.trim(),
          email: email.trim(),
        },
      );
      const updatedProfile = response.data.data?.profile;

      if (!response.data.success || !updatedProfile) {
        throw new Error(response.data.message || t("account.saveError"));
      }

      setProfile(updatedProfile);
      setFullName(updatedProfile.full_name ?? "");
      setEmail(updatedProfile.email ?? "");
      setIsEditing(false);
      setNotice(t("account.saved"));
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, t("account.saveError")));
    } finally {
      setIsSaving(false);
    }
 });

  const confirmLogout = () => {
    Alert.alert(t("account.logoutTitle"), t("account.logoutMessage"), [
      { text: t("account.cancel"), style: "cancel" },
      {
        text: t("account.logout"),
        style: "destructive",
        onPress: () => {
          void logout().catch((error: unknown) => {
            Alert.alert(
              t("account.logoutErrorTitle"),
              getErrorMessage(error, t("account.logoutError")),
            );
          });
        },
      },
    ]);
  };

  const displayName = profile?.full_name || t("account.title");
  const mobileNumber = profile?.mobile_number || user?.mobile_number || "";

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t("account.title")}
          </Text>
          <Text
            style={[styles.subtitle, { color: theme.colors.textSecondary }]}
          >
            {t("account.subtitle")}
          </Text>
        </View>

        <View
          style={[
            styles.identityCard,
            {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.primary,
            },
          ]}
        >
          <View
            style={[styles.avatar, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
              {getInitials(profile?.full_name ?? "", mobileNumber)}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text
              numberOfLines={1}
              style={[styles.identityName, { color: theme.colors.onPrimary }]}
            >
              {displayName}
            </Text>
            {mobileNumber ? (
              <Text
                style={[
                  styles.identityMobile,
                  { color: theme.colors.onPrimary, opacity: 0.88 },
                ]}
              >
                {mobileNumber}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={[styles.accountShortcuts, { justifyContent: "space-between" }]}
        >
          <Link href="/(protected)/orders" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("account.ordersButtonLabel")}
              style={({ pressed }) => [
                styles.accountShortcut,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <View
                style={[
                  styles.shortcutContent,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    paddingHorizontal: 28,
                  },
                ]}
              >
                <SymbolView
                  name={{
                    ios: "shippingbox",
                    android: "inventory_2",
                    web: "inventory_2",
                  }}
                  tintColor="#1769D2"
                  size={34}
                  accessible={false}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.shortcutTitle, { color: theme.colors.text }]}
                >
                  {t("account.ordersButtonLabel")}
                </Text>
              </View>
            </Pressable>
          </Link>

          <Link href="/(protected)/wishlist" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("account.wishlistTitle")}
              style={({ pressed }) => [
                styles.accountShortcut,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.76 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <View
                style={[
                  styles.shortcutContent,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    paddingHorizontal: 28,
                  },
                ]}
              >
                <SymbolView
                  name={{
                    ios: "heart",
                    android: "favorite_border",
                    web: "favorite_border",
                  }}
                  tintColor="#1769D2"
                  size={34}
                  accessible={false}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.shortcutTitle, { color: theme.colors.text }]}
                >
                  {t("account.wishlistTitle")}
                </Text>
              </View>
            </Pressable>
          </Link>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t("account.personalInformation")}
              </Text>
              <Text
                style={[
                  styles.sectionDescription,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {t("account.profileDescription")}
              </Text>
            </View>
            {!isLoading && profile && !isEditing ? (
              <Pressable
                accessibilityRole="button"
                onPress={beginEditing}
                style={({ pressed }) => [
                  styles.textButton,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.textButtonLabel,
                    { color: theme.colors.primary },
                  ]}
                >
                  {t("account.edit")}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {isLoading ? (
            <ProfileFieldsSkeleton label={t("account.loading")} />
          ) : profile ? (
            <View style={styles.fields}>
              <ProfileField
                label={t("account.fullName")}
                value={fullName}
                placeholder={t("account.fullNamePlaceholder")}
                editable={isEditing}
                onChangeText={setFullName}
                theme={theme}
                testID="account-full-name"
              />
              <ProfileField
                label={t("account.mobileNumber")}
                value={mobileNumber}
                editable={false}
                theme={theme}
              />
              <ProfileField
                label={t("account.email")}
                value={email}
                placeholder={t("account.emailPlaceholder")}
                editable={isEditing}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                theme={theme}
                testID="account-email"
              />
              {isEditing ? (
                <View style={styles.editActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={cancelEditing}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      {
                        borderColor: theme.colors.border,
                        opacity: pressed || isSaving ? 0.65 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.secondaryButtonText,
                        { color: theme.colors.text },
                      ]}
                    >
                      {t("account.cancel")}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isSaving}
                    onPress={() => void saveProfile()}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: pressed || isSaving ? 0.75 : 1,
                      },
                    ]}
                  >
                    {isSaving ? (
                      <ActivityIndicator color={theme.colors.onPrimary} />
                    ) : (
                      <Text
                        style={[
                          styles.primaryButtonText,
                          { color: theme.colors.onPrimary },
                        ]}
                      >
                        {t("account.save")}
                      </Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.loadError}>
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errorMessage}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setIsLoading(true);
                  setErrorMessage("");
                  void loadProfile();
                }}
                style={[
                  styles.retryButton,
                  { borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.retryLabel, { color: theme.colors.text }]}>
                  {t("account.retry")}
                </Text>
              </Pressable>
            </View>
          )}

          {errorMessage && profile ? (
            <Text
              style={[
                styles.errorText,
                styles.inlineMessage,
                { color: theme.colors.error },
              ]}
            >
              {errorMessage}
            </Text>
          ) : null}
          {notice ? (
            <Text
              style={[
                styles.successText,
                styles.inlineMessage,
                { color: theme.colors.success },
              ]}
            >
              {notice}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t("account.addresses")}
          </Text>
          <Text
            style={[
              styles.sectionDescription,
              styles.addressDescription,
              { color: theme.colors.textSecondary },
            ]}
          >
            {t("account.addressesDescription")}
          </Text>
          <FarmerLocationPicker />
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {t("account.preferences")}
          </Text>
          <Text
            style={[
              styles.preferenceLabel,
              { color: theme.colors.textSecondary },
            ]}
          >
            {t("account.language")}
          </Text>
          <View style={styles.choiceRow}>
            {languageOptions.map((option) => (
              <ChoiceButton
                key={option.value}
                label={option.label}
                selected={language === option.value}
                onPress={() => {
                  setPreferenceError("");
                  void changeLanguage(option.value).catch((error: unknown) => {
                    setPreferenceError(
                      getErrorMessage(error, t("account.languageError")),
                    );
                  });
                }}
                theme={theme}
              />
            ))}
          </View>

          <View
            style={[styles.divider, { backgroundColor: theme.colors.border }]}
          />

          <Text
            style={[
              styles.preferenceLabel,
              { color: theme.colors.textSecondary },
            ]}
          >
            {t("account.appearance")}
          </Text>
          <View style={styles.choiceRow}>
            <ChoiceButton
              label={t("account.themeSystem")}
              selected={preference === "system"}
              onPress={() => setMode("system")}
              theme={theme}
            />
            <ChoiceButton
              label={t("account.themeLight")}
              selected={preference === "light"}
              onPress={() => setMode("light")}
              theme={theme}
            />
            <ChoiceButton
              label={t("account.themeDark")}
              selected={preference === "dark"}
              onPress={() => setMode("dark")}
              theme={theme}
            />
          </View>
          <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
            {t("account.themeHint")}
          </Text>
          {preferenceError ? (
            <Text
              style={[
                styles.errorText,
                styles.inlineMessage,
                { color: theme.colors.error },
              ]}
            >
              {preferenceError}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={confirmLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.logoutLabel, { color: theme.colors.error }]}>
            {t("account.logout")}
          </Text>
        </Pressable>

        <Text style={[styles.footer, { color: theme.colors.textMuted }]}>
          {t("account.footer")}
        </Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

type ProfileFieldProps = {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
  editable: boolean;
  placeholder?: string;
  onChangeText?: (value: string) => void;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences";
  testID?: string;
};

function ProfileField({
  label,
  value,
  theme,
  editable,
  placeholder,
  onChangeText,
  keyboardType = "default",
  autoCapitalize = "sentences",
  testID,
}: ProfileFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
      {editable ? (
        <TextInput
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          editable={editable}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
              color: theme.colors.text,
            },
          ]}
          testID={testID}
          value={value}
        />
      ) : (
        <Text style={[styles.fieldValue, { color: theme.colors.text }]}>
          {value || "—"}
        </Text>
      )}
    </View>
  );
}

type ChoiceButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
};

function ChoiceButton({ label, selected, onPress, theme }: ChoiceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceButton,
        {
          backgroundColor: selected
            ? theme.colors.primary
            : theme.colors.background,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.choiceLabel,
          { color: selected ? theme.colors.onPrimary : theme.colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  page: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
    gap: 16,
  },
  header: { marginBottom: 2 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  identityCard: {
    minHeight: 116,
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 21, fontWeight: "700" },
  identityText: { flex: 1, minWidth: 0 },
  identityName: { fontSize: 20, fontWeight: "700" },
  identityMobile: { fontSize: 13, marginTop: 6 },
  accountShortcuts: {
    flexDirection: "row",
    gap: 12,
  },
  accountShortcut: {
    minHeight: 64,
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shortcutContent: {
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 5,
  },
  shortcutTitle: {
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
    minWidth: 0,
    textAlign: "center",
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  sectionHeading: { flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: "700" },
  sectionDescription: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  addressDescription: { marginBottom: 8 },
  textButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  textButtonLabel: { fontSize: 14, fontWeight: "700" },
  fields: { gap: 14 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600" },
  fieldValue: { minHeight: 24, fontSize: 15, paddingVertical: 3 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 15,
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { fontSize: 15, fontWeight: "600" },
  loadError: { alignItems: "flex-start", gap: 12 },
  errorText: { fontSize: 13, lineHeight: 19 },
  successText: { fontSize: 13, lineHeight: 19 },
  inlineMessage: { marginTop: 12 },
  retryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 11,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  retryLabel: { fontSize: 14, fontWeight: "600" },
  preferenceLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 18,
    marginBottom: 10,
  },
  choiceRow: { flexDirection: "row", gap: 8 },
  choiceButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  choiceLabel: { fontSize: 13, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 18 },
  helperText: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  logoutButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutLabel: { fontSize: 15, fontWeight: "700" },
  footer: { fontSize: 12, textAlign: "center", marginTop: 2 },
});
