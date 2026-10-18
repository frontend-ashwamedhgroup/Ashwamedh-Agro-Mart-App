// Crop Doctor home: start a new diagnosis and see past ones.
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { diagnosisStatusKey } from "../../../components/cropDoctor/DiagnosisResult";
import { CardListSkeleton } from "../../../components/shop/Skeletons";
import { ErrorView, MessageView, RefreshFailedNotice } from "../../../components/shop/StateViews";
import { useAsync } from "../../../hooks/useAsync";
import { fetchDiagnoses } from "../../../services/cropDoctor/api";
import { localizedConditionName } from "../../../services/cropDoctor/localize";
import { DEFAULT_DIAGNOSIS_LANGUAGE } from "../../../services/cropDoctor/types";
import { useTheme } from "../../../theme";
import { formatPrice } from "../../../utils/money";

const statusIcon: Record<ReturnType<typeof diagnosisStatusKey>, keyof typeof Ionicons.glyphMap> = {
  priceReady: "pricetag-outline",
  healthy: "checkmark-circle-outline",
  confirmPending: "help-circle-outline",
  contactShop: "call-outline",
};

export default function DiagnosisScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { data, isLoading, error, reload } = useAsync(fetchDiagnoses, []);

  // Prices are prepared while the farmer is away, so refresh on coming back.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const startNew = () => router.push("/(protected)/crop-doctor/new");

  const statusColor = (status: ReturnType<typeof diagnosisStatusKey>) =>
    status === "priceReady" || status === "healthy"
      ? theme.colors.success
      : status === "confirmPending"
        ? theme.colors.warning
        : theme.colors.textSecondary;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t("cropDoctor.title")}</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {t("cropDoctor.subtitle")}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={startNew}
          style={({ pressed }) => [
            styles.newButton,
            { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="camera-outline" size={24} color={theme.colors.onPrimary} />
          <Text style={[styles.newText, { color: theme.colors.onPrimary }]}>{t("cropDoctor.startNew")}</Text>
        </Pressable>
        <Text style={[styles.section, { color: theme.colors.text }]}>{t("cropDoctor.historyTitle")}</Text>
      </View>

      {isLoading && !data ? (
        <CardListSkeleton />
      ) : !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : (
        <>
          <RefreshFailedNotice error={error} onRetry={reload} />
          <FlatList
            data={data}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            onRefresh={reload}
            refreshing={isLoading}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <MessageView title={t("cropDoctor.empty")} message={t("cropDoctor.emptyHint")} />
            }
            renderItem={({ item }) => {
              const status = diagnosisStatusKey(item);
              const color = statusColor(status);
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: "/(protected)/crop-doctor/[id]", params: { id: String(item.id) } })
                  }
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
                    <Ionicons name={statusIcon[status]} size={24} color={color} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text numberOfLines={1} style={[styles.crop, { color: theme.colors.text }]}>
                      {item.crop_name}
                    </Text>
                    <Text numberOfLines={2} style={[styles.condition, { color }]}>
                      {(item.outcome === "sure" &&
                        localizedConditionName(item, DEFAULT_DIAGNOSIS_LANGUAGE)) ||
                        t(`cropDoctor.status.${status}`)}
                    </Text>
                    {item.created_at ? (
                      <Text style={[styles.date, { color: theme.colors.textMuted }]}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </View>
                  {status === "priceReady" && item.price ? (
                    <Text style={[styles.price, { color: theme.colors.text }]}>
                      {formatPrice(item.price.amount, item.price.currency)}
                    </Text>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                  )}
                </Pressable>
              );
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { gap: 12, paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 21 },
  newButton: {
    alignItems: "center",
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 60,
    marginTop: 4,
  },
  newText: { fontSize: 18, fontWeight: "700" },
  section: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  list: { flexGrow: 1, gap: 12, padding: 20, paddingTop: 12, paddingBottom: 30 },
  card: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 14, padding: 14 },
  iconWrap: { alignItems: "center", borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  cardBody: { flex: 1, gap: 2 },
  crop: { fontSize: 18, fontWeight: "700" },
  condition: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  date: { fontSize: 12 },
  price: { fontSize: 17, fontWeight: "800" },
});
