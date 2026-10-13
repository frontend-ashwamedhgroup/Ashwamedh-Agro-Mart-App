import { router } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TabScreenBody } from "../../../components/shop/TabScreenBody";
import { QuantityStepper } from "../../../components/shop/QuantityStepper";
import { CartSkeleton } from "../../../components/shop/Skeletons";
import { ErrorView, MessageView, RefreshFailedNotice } from "../../../components/shop/StateViews";
import { useCart } from "../../../context/CartContext";
import type { CartItem } from "../../../services/shop/types";
import { useTheme } from "../../../theme";
import { formatPrice } from "../../../utils/money";

export default function CartScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { cart, isLoading, error, refresh, setQuantity, removeItem, clear } = useCart();
  const [busyId, setBusyId] = useState<number | "all" | null>(null);

  const guard = useCallback(
    async (id: number | "all", action: () => Promise<void>) => {
      if (busyId !== null) return;
      setBusyId(id);
      try {
        await action();
      } catch (e: unknown) {
        Alert.alert(
          t("shopping.cartError"),
          (e instanceof Error && e.message) || t("shopping.tryAgain"),
        );
      } finally {
        setBusyId(null);
      }
    },
    [busyId, t],
  );

  const confirmClear = () =>
    Alert.alert(t("shopping.clearCartTitle"), t("shopping.clearCartMessage"), [
      { text: t("shopping.cancel"), style: "cancel" },
      {
        text: t("shopping.clearCart"),
        style: "destructive",
        onPress: () => void guard("all", clear),
      },
    ]);

  const items = cart?.items ?? [];

  const renderItem = ({ item }: { item: CartItem }) => {
    const quantity = Number(item.quantity);
    const max = Math.max(1, Math.floor(Number(item.quantity_on_hand)));
    return (
      <View
        style={[
          styles.item,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          busyId === item.id && styles.busy,
        ]}
      >
        <View style={styles.itemTop}>
          <View style={styles.itemText}>
            <Text numberOfLines={2} style={[styles.itemName, { color: theme.colors.text }]}>
              {item.product_name}
            </Text>
            <Text style={[styles.itemMeta, { color: theme.colors.textSecondary }]}>
              {item.packing_label || item.presentation} ·{" "}
              {formatPrice(item.unit_price, item.currency)}
            </Text>
            {!item.in_stock ? (
              <Text style={{ color: theme.colors.error, fontSize: 12, fontWeight: "600" }}>
                {t("shopping.outOfStock")}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.lineTotal, { color: theme.colors.text }]}>
            {formatPrice(item.line_total, item.currency)}
          </Text>
        </View>
        <View style={styles.itemBottom}>
          <QuantityStepper
            value={quantity}
            min={1}
            max={max}
            disabled={busyId !== null}
            onChange={(next) => void guard(item.id, () => setQuantity(item.id, next))}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("shopping.remove")} ${item.product_name}`}
            disabled={busyId !== null}
            hitSlop={8}
            onPress={() => void guard(item.id, () => removeItem(item.id))}
          >
            <Text style={{ color: theme.colors.error, fontWeight: "600" }}>
              {t("shopping.remove")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t("navigation.cart")}</Text>
        {items.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={confirmClear} hitSlop={8}>
            <Text style={{ color: theme.colors.error, fontWeight: "600" }}>
              {t("shopping.clearCart")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <TabScreenBody>
      {isLoading && !cart ? (
        <CartSkeleton />
      ) : !cart ? (
        <ErrorView message={error} onRetry={refresh} />
      ) : items.length === 0 ? (
        <MessageView
          title={t("shopping.cartEmpty")}
          message={t("shopping.cartDescription")}
          actionLabel={t("shopping.startShopping")}
          onAction={() => router.navigate("/(protected)/(tabs)/dashboard")}
        />
      ) : (
        <>
          <RefreshFailedNotice error={error} onRetry={refresh} />
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onRefresh={refresh}
            refreshing={isLoading}
            showsVerticalScrollIndicator={false}
          />
          <View style={[styles.summary, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={{ color: theme.colors.textSecondary }}>{t("shopping.subtotal")}</Text>
              <Text style={{ color: theme.colors.text }}>{formatPrice(cart.subtotal, cart.currency)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.totalLabel, { color: theme.colors.text }]}>{t("shopping.total")}</Text>
              <Text style={[styles.totalLabel, { color: theme.colors.text }]}>
                {formatPrice(cart.total, cart.currency)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={busyId !== null || items.some((item) => !item.in_stock)}
              onPress={() => router.push("/(protected)/checkout")}
              style={[
                styles.checkout,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: busyId !== null || items.some((item) => !item.in_stock) ? 0.4 : 1,
                },
              ]}
            >
              <Text style={[styles.checkoutText, { color: theme.colors.onPrimary }]}>
                {t("shopping.checkout")}
              </Text>
            </Pressable>
          </View>
        </>
      )}
      </TabScreenBody>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: "700" },
  list: { gap: 12, padding: 20, paddingTop: 8 },
  item: { borderRadius: 16, borderWidth: 1, gap: 12, padding: 14 },
  busy: { opacity: 0.6 },
  itemTop: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  itemText: { flex: 1, gap: 3 },
  itemName: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  itemMeta: { fontSize: 13 },
  lineTotal: { fontSize: 15, fontWeight: "700" },
  itemBottom: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  summary: { borderTopWidth: StyleSheet.hairlineWidth, gap: 8, padding: 20 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 17, fontWeight: "700" },
  checkout: { alignItems: "center", borderRadius: 14, justifyContent: "center", marginTop: 8, minHeight: 52 },
  checkoutText: { fontSize: 16, fontWeight: "700" },
});
