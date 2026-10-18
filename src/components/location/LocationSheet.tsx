import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLocationFlow } from "../../context/LocationContext";
import type { CurrentLocationFailure } from "../../hooks/useCurrentLocation";
import { AddressListSkeleton } from "../skeleton/AddressListSkeleton";
import { useTheme } from "../../theme";
import { useBrandColors } from "./useBrandColors";
import {
  getAddressSubtitle,
  getAddressTitle,
  selectionFromAddress,
} from "./utils";

const FAILURE_KEYS: Record<CurrentLocationFailure, string> = {
  permission: "location.permissionDenied",
  services: "location.servicesDisabled",
  unavailable: "location.currentUnavailable",
};

const ADDRESS_ICONS = {
  home: { ios: "house", android: "home", web: "home" },
  farm: { ios: "leaf", android: "grass", web: "grass" },
  other: {
    ios: "mappin.and.ellipse",
    android: "location_on",
    web: "location_on",
  },
} as const;

export function LocationSheet() {
  const {
    current,
    services,
    addresses,
    recent,
    chooseLocation: onSelect,
    openMap: onPickPoint,
  } = useLocationFlow();
  const savedAddresses = addresses.addresses;
  const isLoadingAddresses = addresses.isLoading;
  const addressesError = addresses.error !== null;
  const { refresh: refreshAddresses } = addresses;

  useEffect(() => {
    void refreshAddresses();
  }, [refreshAddresses]);

  const { theme } = useTheme();
  const { brand, brandSoft } = useBrandColors();
  const { t } = useTranslation();
  const [failure, setFailure] = useState<CurrentLocationFailure | null>(null);
  // Which row is waiting. Kept here rather than read from `current.isLocating`,
  // which is shared with "Add new address" and the header picker, so only the
  // tapped row shows a spinner.
  const [busyAction, setBusyAction] = useState<"current" | "add" | null>(null);

  const { colors } = theme;
  const card = { backgroundColor: colors.surface, borderColor: colors.border };

  const useMyLocation = async () => {
    setFailure(null);
    setBusyAction("current");
    try {
      const result = await current.locate();
      if (result.ok) {
        await onPickPoint(result.coordinate);
      } else if (result.reason === "services") {
        // The "turn on location" sheet explains this; no inline message.
        services.showPrompt();
      } else {
        setFailure(result.reason);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const addNewAddress = async () => {
    setFailure(null);
    setBusyAction("add");
    try {
      await onPickPoint();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {t("location.title")}
        </Text>
        <Pressable
          accessibilityLabel={t("location.close")}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={[styles.closeButton, { backgroundColor: colors.surface }]}
        >
          <SymbolView
            name={{ ios: "xmark", android: "close", web: "close" }}
            size={18}
            tintColor={colors.text}
            accessible={false}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <>
            <ActionRow
              accent={brand}
              busy={busyAction === "current"}
              disabled={busyAction !== null}
              icon={{ ios: "scope", android: "my_location" }}
              onPress={useMyLocation}
              subtitle={
                busyAction === "current"
                  ? t("location.gettingLocation")
                  : t("location.currentLocationHint")
              }
              title={t("location.useCurrent")}
            />
            {failure ? (
              <View style={styles.failure}>
                <Text
                  accessibilityRole="alert"
                  style={[styles.failureText, { color: colors.error }]}
                >
                  {t(FAILURE_KEYS[failure])}
                </Text>
                {failure === "permission" && !current.canAskAgain ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={current.openSettings}
                  >
                    <Text style={[styles.link, { color: brand }]}>
                      {t("location.openSettings")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <ActionRow
              accent={brand}
              busy={busyAction === "add"}
              disabled={busyAction !== null}
              icon={{ ios: "plus", android: "add" }}
              onPress={addNewAddress}
              title={t("location.addNewAddress")}
            />

            <SectionLabel text={t("location.savedAddresses")} />
            {isLoadingAddresses ? (
              <AddressListSkeleton label={t("location.loadingAddresses")} />
            ) : addressesError ? (
              <Text style={[styles.failureText, { color: colors.error }]}>
                {t("location.loadAddressesError")}
              </Text>
            ) : savedAddresses.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>
                {t("location.noSavedAddresses")}
              </Text>
            ) : (
              <View style={styles.list}>
                {savedAddresses.map((address) => (
                  <Pressable
                    key={address.id}
                    accessibilityRole="button"
                    onPress={() => onSelect(selectionFromAddress(address))}
                    style={[styles.row, card]}
                  >
                    <View
                      style={[styles.iconBubble, { backgroundColor: brandSoft }]}
                    >
                      <SymbolView
                        name={ADDRESS_ICONS[address.address_type]}
                        size={20}
                        tintColor={brand}
                        accessible={false}
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Text
                        numberOfLines={1}
                        style={[styles.rowTitle, { color: colors.text }]}
                      >
                        {address.label || t(`location.${address.address_type}`)}
                        {address.is_default
                          ? ` · ${t("location.default")}`
                          : ""}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.rowSubtitle,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {[getAddressTitle(address), getAddressSubtitle(address)]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {recent.length > 0 ? (
              <>
                <SectionLabel text={t("location.recentLocations")} />
                <View style={styles.list}>
                  {recent.map((item) => (
                    <Pressable
                      key={item.label}
                      accessibilityRole="button"
                      onPress={() => onSelect(item)}
                      style={[styles.row, card]}
                    >
                      <View style={styles.iconBubble}>
                        <SymbolView
                          name={{
                            ios: "clock",
                            android: "schedule",
                            web: "schedule",
                          }}
                          size={20}
                          tintColor={colors.textSecondary}
                          accessible={false}
                        />
                      </View>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.rowTitle,
                          styles.rowText,
                          { color: colors.text },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
        </>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
      {text}
    </Text>
  );
}

type ActionRowProps = {
  accent: string;
  title: string;
  subtitle?: string;
  busy?: boolean;
  /** Blocks taps without a spinner, e.g. while the other row is busy. */
  disabled?: boolean;
  icon: { ios: "scope" | "plus"; android: "my_location" | "add" };
  onPress: () => void;
};

function ActionRow({
  accent,
  title,
  subtitle,
  busy,
  disabled,
  icon,
  onPress,
}: ActionRowProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(busy) }}
      disabled={busy || disabled}
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={accent} style={styles.iconBubble} />
      ) : (
        <View style={styles.iconBubble}>
          <SymbolView
            name={{ ios: icon.ios, android: icon.android, web: icon.android }}
            size={24}
            tintColor={accent}
            accessible={false}
          />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: accent }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <SymbolView
        name={{
          ios: "chevron.right",
          android: "chevron_right",
          web: "chevron_right",
        }}
        size={16}
        tintColor={colors.textMuted}
        accessible={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: { fontSize: 22, fontWeight: "800" },
  closeButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  content: { gap: 12, padding: 20, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 12,
    textTransform: "uppercase",
  },
  list: { gap: 10 },
  row: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    padding: 14,
  },
  iconBubble: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowSubtitle: { fontSize: 13, lineHeight: 18 },
  inline: { alignItems: "center", flexDirection: "row", gap: 10 },
  failure: { gap: 6 },
  failureText: { fontSize: 13, lineHeight: 19 },
  link: { fontSize: 14, fontWeight: "700" },
});
