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
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
  useKeyboardState,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type {
  AddressDraft,
  AddressType,
} from "./types";
import { useBrandColors } from "./useBrandColors";
import {
  ADDRESS_LINE_MAX,
  getAreaLabel,
  getDisplayLabel,
  isDraftComplete,
  isValidPostalCode,
  joinParts,
  selectionFromAddress,
} from "./utils";
import { Skeleton } from "../../components/skeleton/Skeleton";
import { useAuth } from "../../context/AuthContext";
import { useLocationFlow } from "../../context/LocationContext";
import { getApiErrorMessage } from "../../hooks/useFarmerAddresses";
import { useSingleFlight } from "../../hooks/useSingleFlight";
import { useTheme } from "../../theme";

const ADDRESS_TYPES: {
  type: AddressType;
  ios: "house" | "leaf" | "mappin.and.ellipse";
  android: "home" | "grass" | "location_on";
}[] = [
  { type: "home", ios: "house", android: "home" },
  { type: "farm", ios: "leaf", android: "grass" },
  { type: "other", ios: "mappin.and.ellipse", android: "location_on" },
];

/**
 * Delivery-details form shown over the map: a native form sheet on iOS (see
 * the Stack.Screen options in the (protected) layout) and an in-screen panel on
 * Android (see location-map.tsx), where a native sheet can be dragged away. It has a single fixed height; the form scrolls inside it
 * and the Save button stays pinned at the bottom while the pin moves on the
 * map above.
 */
export function DeliveryDetailsForm() {
  const { theme } = useTheme();
  const { brand, brandSoft, onBrand } = useBrandColors();
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    addresses,
    isFirstAddress,
    pin,
    place,
    isResolving,
    draft,
    updateDraft,
    chooseLocation,
  } = useLocationFlow();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);

  const [showAreaFields, setShowAreaFields] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const singleFlight = useSingleFlight();

  // The sheet is short, so when the keyboard opens the house / floor field can
  // end up hidden below it; re-check once the keyboard has finished animating.
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const keepDetailsVisible = () => {
    setTimeout(() => scrollRef.current?.assureFocusedInputVisible(), 250);
  };

  const areaIncomplete = !isResolving && !isDraftComplete(draft);
  const areaFieldsVisible = showAreaFields || areaIncomplete;

  const edit = <K extends keyof AddressDraft>(
    key: K,
    value: AddressDraft[K],
  ) => {
    updateDraft(key, value);
    setError("");
  };

  const save = () => singleFlight(async () => {
    setError("");

    if (!isDraftComplete(draft)) {
      setShowAreaFields(true);
      setError(t("location.requiredFields"));
      return;
    }
    if (!isValidPostalCode(draft.postal_code)) {
      setShowAreaFields(true);
      setError(t("location.invalidPostalCode"));
      return;
    }

    setIsSaving(true);
    try {
      // The API requires address_line1. The farmer's own details (plot / house
      // no.) come first, followed by the street-level part of the pinned place;
      // the area fields are sent separately.
      const addressLine = joinParts([
        draft.address_line1,
        place.line1 || place.title,
      ])
        .slice(0, ADDRESS_LINE_MAX)
        .trim() || getAreaLabel(draft) || draft.city;
      const created = await addresses.createAddress({
        draft: { ...draft, address_line1: addressLine },
        label: t(`location.${draft.address_type}`),
        coordinate: pin.coordinate,
        isDefault: isFirstAddress,
      });
      const selection = selectionFromAddress(created);

      await chooseLocation({
        ...selection,
        label: selection.label || getDisplayLabel(draft),
        coordinate: selection.coordinate ?? pin.coordinate,
      });
    } catch (saveError: unknown) {
      console.error("Failed to save farmer address:", saveError);
      setError(getApiErrorMessage(saveError) || t("location.saveAddressError"));
    } finally {
      setIsSaving(false);
    }
 });

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        ref={scrollRef}
        bottomOffset={24}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {t("location.deliveryDetails")}
        </Text>
        <Pressable
          accessibilityLabel={t("location.editAreaDetails")}
          accessibilityRole="button"
          onPress={() => setShowAreaFields((visible) => !visible)}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <SymbolView
            name={{
              ios: "mappin.and.ellipse",
              android: "location_on",
              web: "location_on",
            }}
            size={26}
            tintColor={brand}
            accessible={false}
          />
          <View style={styles.cardText}>
            {isResolving ? (
              <View
                accessibilityLabel={t("location.resolvingAddress")}
                accessibilityState={{ busy: true }}
                style={styles.skeletonLines}
              >
                <Skeleton height={16} radius={6} width="55%" />
                <Skeleton height={13} radius={6} width="85%" />
              </View>
            ) : (
              <>
                <Text
                  numberOfLines={1}
                  style={[styles.cardTitle, { color: colors.text }]}
                >
                  {place.title || t("location.pinnedLocation")}
                </Text>
                {place.subtitle ? (
                  <Text
                    numberOfLines={2}
                    style={{ color: colors.textSecondary }}
                  >
                    {place.subtitle}
                  </Text>
                ) : null}
              </>
            )}
          </View>
          <SymbolView
            name={{
              ios: areaFieldsVisible ? "chevron.up" : "chevron.down",
              android: areaFieldsVisible ? "expand_less" : "expand_more",
              web: areaFieldsVisible ? "expand_less" : "expand_more",
            }}
            size={16}
            tintColor={colors.textMuted}
            accessible={false}
          />
        </Pressable>

        {place.failed && !isResolving ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t("location.addressNotAvailable")}
          </Text>
        ) : null}

        {areaFieldsVisible ? (
          <View style={styles.areaFields}>
            <TextInput
              accessibilityLabel={t("location.village")}
              onChangeText={(value) => edit("village", value)}
              placeholder={t("location.villagePlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
              value={draft.village}
            />
            <TextInput
              accessibilityLabel={t("location.city")}
              onChangeText={(value) => edit("city", value)}
              placeholder={t("location.cityPlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
              value={draft.city}
            />
            <TextInput
              accessibilityLabel={t("location.district")}
              onChangeText={(value) => edit("district", value)}
              placeholder={t("location.districtPlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
              value={draft.district}
            />
            <TextInput
              accessibilityLabel={t("location.state")}
              onChangeText={(value) => edit("state", value)}
              placeholder={t("location.statePlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
              value={draft.state}
            />
            <TextInput
              accessibilityLabel={t("location.postalCode")}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) =>
                edit("postal_code", value.replace(/\D/g, ""))
              }
              placeholder={t("location.postalCodePlaceholder")}
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
              value={draft.postal_code}
            />
          </View>
        ) : null}

        <TextInput
          accessibilityLabel={t("location.addressDetails")}
          onFocus={keepDetailsVisible}
          onChangeText={(value) => edit("address_line1", value)}
          placeholder={t("location.addressDetails")}
          placeholderTextColor={colors.textMuted}
          style={[inputStyle, styles.detailsInput]}
          value={draft.address_line1}
        />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t("location.addressDetailsHint")}
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {t("location.receiverDetails")}
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <SymbolView
            name={{ ios: "phone", android: "call", web: "call" }}
            size={22}
            tintColor={colors.textSecondary}
            accessible={false}
          />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {user?.mobile_number ?? ""}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {t("location.saveAddressAs")}
        </Text>
        <View style={styles.chips}>
          {ADDRESS_TYPES.map(({ type, ios, android }) => {
            const selected = draft.address_type === type;
            return (
              <Pressable
                key={type}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => edit("address_type", type)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? brandSoft : colors.surface,
                    borderColor: selected ? brand : colors.border,
                  },
                ]}
              >
                <SymbolView
                  name={{ ios, android, web: android }}
                  size={18}
                  tintColor={selected ? brand : colors.textSecondary}
                  accessible={false}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? brand : colors.text },
                  ]}
                >
                  {t(`location.${type}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? (
          <Text
            accessibilityRole="alert"
            style={[styles.error, { color: colors.error }]}
          >
            {error}
          </Text>
        ) : null}
      </KeyboardAwareScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            // Keep the Save button clear of the system nav bar / home indicator.
            paddingBottom: 16 + (isKeyboardVisible ? 0 : insets.bottom),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          disabled={isSaving || isResolving}
          onPress={save}
          style={[
            styles.saveButton,
            {
              backgroundColor: brand,
              opacity: isSaving || isResolving ? 0.6 : 1,
            },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color={onBrand} />
          ) : (
            <Text style={[styles.saveText, { color: onBrand }]}>
              {t("location.saveAddress")}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  scroll: { flex: 1 },
  form: { gap: 10, padding: 20, paddingBottom: 12 },
  sectionLabel: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  card: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 60,
    padding: 14,
  },
  cardText: { flex: 1, gap: 2 },
  skeletonLines: { gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  areaFields: { gap: 10 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    height: 50,
    paddingHorizontal: 14,
  },
  detailsInput: { height: 56 },
  hint: { fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: "row", gap: 10 },
  chip: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: { fontSize: 14, fontWeight: "600" },
  error: { fontSize: 13, lineHeight: 19 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
  },
  saveText: { fontSize: 17, fontWeight: "700" },
});
