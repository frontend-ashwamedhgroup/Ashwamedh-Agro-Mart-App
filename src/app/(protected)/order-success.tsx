// Shown after checkout places an order: payment confirmed, payment still
// being confirmed, or cash on delivery. Replaces the checkout screen, so going
// back never returns to a cart that has already been ordered.
import { SymbolView } from "expo-symbols";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../theme";
import { formatPrice } from "../../utils/money";

export type OrderOutcome = "paid" | "pending" | "cod";

export default function OrderSuccessScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { id, outcome, total, currency, paymentId } = useLocalSearchParams<{
    id: string;
    outcome: OrderOutcome;
    total?: string;
    currency?: string;
    paymentId?: string;
  }>();

  const viewOrder = () =>
    router.replace({ pathname: "/(protected)/order/[id]", params: { id } });
  const continueShopping = () => router.dismissTo("/(protected)/(tabs)/dashboard");

  // Android back leaves to the shop, the same as "Continue shopping".
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      continueShopping();
      return true;
    });
    return () => sub.remove();
  }, []);

  const pending = outcome === "pending";
  const title =
    outcome === "paid"
      ? t("shopping.paymentSuccess")
      : pending
        ? t("shopping.paymentPending")
        : t("shopping.orderPlaced");
  const message =
    outcome === "paid"
      ? t("shopping.paymentSuccessMessage", { id })
      : pending
        ? t("shopping.paymentPendingMessage", { id })
        : t("shopping.orderPlacedMessage", { id });
  const accent = pending ? theme.colors.warning : theme.colors.success;
  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View accessibilityRole="header" style={styles.hero}>
          <SymbolView
            name={
              pending
                ? { ios: "clock.fill", android: "schedule", web: "schedule" }
                : { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }
            }
            size={72}
            tintColor={accent}
            accessible={false}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>
        </View>

        <View style={[styles.box, card]}>
          <Row label={t("shopping.orderId")} value={`#${id}`} />
          {total ? <Row label={t("shopping.total")} value={formatPrice(total, currency ?? "INR")} /> : null}
          <Row
            label={t("shopping.paymentMethod")}
            value={outcome === "cod" ? t("shopping.payCod") : t("shopping.payOnline")}
          />
          {paymentId ? <Row label={t("shopping.paymentId")} value={paymentId} selectable /> : null}
        </View>
      </ScrollView>

      <View style={[styles.bar, { borderTopColor: theme.colors.border }]}>
        <Pressable
          accessibilityRole="button"
          onPress={viewOrder}
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>
            {pending ? t("shopping.trackOrder") : t("shopping.viewOrder")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={continueShopping}
          style={[styles.button, styles.secondary, { borderColor: theme.colors.border }]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>{t("shopping.continueShopping")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, selectable }: { label: string; value: string; selectable?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: theme.colors.textSecondary }}>{label}</Text>
      <Text selectable={selectable} numberOfLines={1} style={[styles.rowValue, { color: theme.colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1, gap: 24, justifyContent: "center", padding: 24 },
  hero: { alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  message: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  box: { borderRadius: 14, borderWidth: 1, gap: 10, padding: 16 },
  row: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  rowValue: { flexShrink: 1, fontWeight: "600", textAlign: "right" },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, gap: 10, paddingHorizontal: 20, paddingVertical: 12 },
  button: { alignItems: "center", borderRadius: 14, justifyContent: "center", minHeight: 50 },
  secondary: { borderWidth: 1 },
  buttonText: { fontSize: 15, fontWeight: "700" },
});
