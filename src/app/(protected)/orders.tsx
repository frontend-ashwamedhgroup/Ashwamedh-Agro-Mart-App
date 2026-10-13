import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "../../components/shop/ScreenHeader";
import { CardListSkeleton } from "../../components/shop/Skeletons";
import { ErrorView, MessageView, RefreshFailedNotice } from "../../components/shop/StateViews";
import { useAsync } from "../../hooks/useAsync";
import { fetchDeliveries, fetchOrders, trackingStatus } from "../../services/shop/orders";
import { useTheme } from "../../theme";
import { formatPrice } from "../../utils/money";

/** Orders plus their deliveries, so the status reflects dispatch progress. */
async function loadOrders() {
  const [orders, deliveries] = await Promise.all([
    fetchOrders(),
    fetchDeliveries().catch(() => []),
  ]);
  const byOrder = new Map(deliveries.map((delivery) => [delivery.order_id, delivery]));
  return orders.map((order) => ({
    ...order,
    trackingStatus: trackingStatus(order, byOrder.get(order.id)),
  }));
}

export default function OrdersScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { data, isLoading, error, reload } = useAsync(loadOrders, []);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t("account.ordersTitle")} />
      {isLoading && !data ? (
        <CardListSkeleton />
      ) : !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : (
        <>
        <RefreshFailedNotice error={error} onRetry={reload} />
        <FlatList
          data={data}
          keyExtractor={(order) => String(order.id)}
          contentContainerStyle={styles.list}
          onRefresh={reload}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <MessageView title={t("shopping.noOrders")} message={t("account.ordersDescription")} />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/(protected)/order/[id]",
                  params: { id: String(item.id) },
                })
              }
              style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            >
              <View style={styles.row}>
                <Text style={[styles.id, { color: theme.colors.text }]}>
                  {t("shopping.orderNumber", { id: item.id })}
                </Text>
                <Text style={[styles.total, { color: theme.colors.text }]}>
                  {formatPrice(item.total, item.currency)}
                </Text>
              </View>
              <Text style={{ color: theme.colors.textSecondary }}>
                {t(`shopping.status.${item.trackingStatus}`, { defaultValue: item.trackingStatus })}
                {" · "}
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
              <Text numberOfLines={1} style={{ color: theme.colors.textMuted }}>
                {item.items.map((line) => line.product_name).join(", ")}
              </Text>
            </Pressable>
          )}
        />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  list: { flexGrow: 1, gap: 12, padding: 20, paddingTop: 4, paddingBottom: 30 },
  card: { borderRadius: 16, borderWidth: 1, gap: 4, padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  id: { fontSize: 16, fontWeight: "700" },
  total: { fontSize: 16, fontWeight: "700" },
});
