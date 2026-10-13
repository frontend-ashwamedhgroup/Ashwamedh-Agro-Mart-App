// Crop Doctor home: start a new diagnosis and see past ones.
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
import { useTheme } from "../../../theme";
import { formatPrice } from "../../../utils/money";

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

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t("cropDoctor.title")}</Text>
        <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>{t("cropDoctor.subtitle")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={startNew}
          style={[styles.newButton, { backgroundColor: theme.colors.primary }]}
        >
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
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: "/(protected)/crop-doctor/[id]", params: { id: String(item.id) } })
                  }
                  style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                >
                  <View style={styles.cardRow}>
                    <Text style={[styles.crop, { color: theme.colors.text }]}>{item.crop_name}</Text>
                    {item.created_at ? (
                      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                    ) : null}
                  </View>
                  {item.outcome === "sure" && item.likely_conditions[0]?.name ? (
                    <Text style={{ color: theme.colors.textSecondary }}>{item.likely_conditions[0].name}</Text>
                  ) : null}
                  <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>
                    {t(`cropDoctor.status.${status}`)}
                    {status === "priceReady" && item.price
                      ? ` · ${formatPrice(item.price.amount, item.price.currency)}`
                      : ""}
                  </Text>
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
  header: { gap: 10, paddingHorizontal: 20, paddingTop: 12 },
  title: { fontSize: 26, fontWeight: "800" },
  section: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  newButton: { alignItems: "center", borderRadius: 14, justifyContent: "center", minHeight: 50 },
  newText: { fontSize: 16, fontWeight: "700" },
  list: { flexGrow: 1, gap: 12, padding: 20, paddingTop: 8, paddingBottom: 30 },
  card: { borderRadius: 16, borderWidth: 1, gap: 4, padding: 16 },
  cardRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  crop: { fontSize: 16, fontWeight: "700" },
});
