import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "../../../components/shop/ScreenHeader";
import { CardListSkeleton } from "../../../components/shop/Skeletons";
import { ErrorView, RefreshFailedNotice } from "../../../components/shop/StateViews";
import { useAsync } from "../../../hooks/useAsync";
import { useSingleFlight } from "../../../hooks/useSingleFlight";
import { isConnectionError } from "../../../services/api/errors";
import {
  awaitingOnlinePayment,
  canViewInvoice,
  fetchDelivery,
  fetchOrder,
  fetchPayment,
  type Delivery,
  TRACKING_STEPS,
  trackingStatus,
  waitForPaid,
} from "../../../services/shop/orders";
import {
  describePaymentFailure,
  PaymentCancelledError,
  payForOrder,
} from "../../../services/shop/payments";
import { useTheme } from "../../../theme";
import { formatPrice } from "../../../utils/money";

function ignoreUnlessConnection(error: unknown): null {
  if (isConnectionError(error)) throw error;
  return null;
}

export default function OrderDetailScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const order = useAsync(() => fetchOrder(id), [id]);
  // Invoice and delivery are created on first read; a server-side failure is
  // non-fatal. Connection errors are rethrown so a network blip keeps the
  // last loaded data (e.g. the delivery handoff code) instead of replacing it with null.
  const payment = useAsync(() => fetchPayment(id).catch(ignoreUnlessConnection), [id]);
  const delivery = useAsync(() => fetchDelivery(id).catch(ignoreUnlessConnection), [id]);

  const [tracking, setTracking] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const singleFlight = useSingleFlight();

  const o = order.data;
  const d: Delivery | null = delivery.data;
  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };

  const refresh = () => Promise.all([order.reload(), payment.reload(), delivery.reload()]);
  const refreshError = order.error ?? delivery.error ?? payment.error;

  const awaitingPayment = !!o && awaitingOnlinePayment(o, payment.data);
  const invoiceReady = !!o && canViewInvoice(o, payment.data);

  // The webhook confirms the payment after the app has finished, so keep
  // looking while the order is unpaid.
  useEffect(() => {
    if (!awaitingPayment) return;
    const timer = setInterval(() => {
      void order.reload();
      void payment.reload();
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingPayment]);

  // Same order id every time: a closed or failed payment can simply be retried.
  const payNow = () =>
    singleFlight(async () => {
      setIsPaying(true);
      try {
        await payForOrder(id, {
          title: t("shopping.appName"),
          description: t("shopping.orderNumber", { id }),
          payer: { name: o?.farmer_name, contact: o?.farmer_mobile },
          color: theme.colors.primary,
        });
        await waitForPaid(id);
      } catch (error: unknown) {
        if (!(error instanceof PaymentCancelledError)) {
          Alert.alert(t("shopping.paymentFailed"), describePaymentFailure(error) || t("shopping.tryAgain"));
        }
      } finally {
        setIsPaying(false);
        void refresh();
      }
    });

  const stage = o ? trackingStatus(o, d) : null;
  const currentStep = stage ? TRACKING_STEPS.indexOf(stage) : -1;
  // The farmer reads this code to the rider on arrival; the rider side completes delivery.
  const showHandoffCode =
    !!d && !["delivered", "failed", "cancelled"].includes(d.status) && stage !== "cancelled";

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t("shopping.orderNumber", { id })} />
      {order.isLoading && !o ? (
        <CardListSkeleton count={3} />
      ) : !o ? (
        <ErrorView message={order.error} onRetry={order.reload} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl onRefresh={refresh} refreshing={order.isLoading} />}
          showsVerticalScrollIndicator={false}
        >
          <RefreshFailedNotice flush error={refreshError} onRetry={refresh} />
          <Text style={{ color: theme.colors.textSecondary }}>
            {t("shopping.placedOn")}: {new Date(o.created_at).toLocaleString()}
          </Text>
          <View style={[styles.box, card]}>
            {stage === "cancelled" ? (
              <Text style={{ color: theme.colors.error, fontWeight: "700" }}>
                {t("shopping.status.cancelled")}
              </Text>
            ) : (
              TRACKING_STEPS.map((step, index) => {
                const done = index <= currentStep;
                return (
                  <View key={step} style={styles.step}>
                    <View style={[styles.dot, { backgroundColor: done ? theme.colors.success : theme.colors.border }]} />
                    <Text style={{ color: done ? theme.colors.text : theme.colors.textMuted, fontWeight: index === currentStep ? "700" : "400" }}>
                      {t(`shopping.status.${step}`)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          <Text style={[styles.section, { color: theme.colors.text }]}>{t("shopping.items")}</Text>
          <View style={[styles.box, card]}>
            {o.items.map((line, index) => (
              <View key={line.id ?? index} style={styles.line}>
                <Text numberOfLines={2} style={[styles.lineName, { color: theme.colors.textSecondary }]}>
                  {line.product_name}
                  {line.packing_label ? ` (${line.packing_label})` : ""} × {Number(line.quantity)}
                </Text>
                <Text style={{ color: theme.colors.text }}>{formatPrice(line.line_total, o.currency)}</Text>
              </View>
            ))}
            {Number(o.delivery_fee) > 0 ? (
              <View style={styles.line}>
                <Text style={{ color: theme.colors.textSecondary }}>{t("shopping.deliveryFee")}</Text>
                <Text style={{ color: theme.colors.text }}>{formatPrice(o.delivery_fee, o.currency)}</Text>
              </View>
            ) : null}
            <View style={styles.line}>
              <Text style={[styles.totalText, { color: theme.colors.text }]}>{t("shopping.total")}</Text>
              <Text style={[styles.totalText, { color: theme.colors.text }]}>{formatPrice(o.total, o.currency)}</Text>
            </View>
          </View>

          {o.delivery_address ? (
            <>
              <Text style={[styles.section, { color: theme.colors.text }]}>{t("shopping.deliveryAddress")}</Text>
              <View style={[styles.box, card]}>
                {o.delivery_address.label ? (
                  <Text style={{ color: theme.colors.text, fontWeight: "600", textTransform: "capitalize" }}>
                    {o.delivery_address.label}
                  </Text>
                ) : null}
                <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>
                  {[
                    o.delivery_address.address_line1,
                    o.delivery_address.address_line2,
                    o.delivery_address.village,
                    o.delivery_address.city,
                    o.delivery_address.district,
                    o.delivery_address.state,
                    o.delivery_address.postal_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              </View>
            </>
          ) : null}

          {o.note ? (
            <Text style={{ color: theme.colors.textSecondary }}>
              {t("shopping.yourNote")}: {o.note}
            </Text>
          ) : null}

          {o.farmer_name || o.farmer_mobile ? (
            <>
              <Text style={[styles.section, { color: theme.colors.text }]}>{t("shopping.customer")}</Text>
              <View style={[styles.box, card]}>
                {o.farmer_name ? <Text style={{ color: theme.colors.text, fontWeight: "600" }}>{o.farmer_name}</Text> : null}
                {o.farmer_mobile ? <Text style={{ color: theme.colors.textSecondary }}>{o.farmer_mobile}</Text> : null}
              </View>
            </>
          ) : null}

          {payment.data ? (
            <>
              <Text style={[styles.section, { color: theme.colors.text }]}>{t("shopping.payment")}</Text>
              <View style={[styles.box, card]}>
                <Text style={{ color: theme.colors.text, fontWeight: "600" }}>
                  {payment.data.payment_method === "COD" ? t("shopping.payCod") : t("shopping.payOnline")}
                </Text>
                <Text style={{ color: theme.colors.textMuted }}>{payment.data.invoice_code}</Text>
                <Text style={{ color: theme.colors.textSecondary }}>
                  {t(`shopping.paymentStatus.${payment.data.status}`, { defaultValue: payment.data.status })}
                  {Number(payment.data.amount_received) > 0
                    ? ` · ${t("shopping.received")} ${formatPrice(payment.data.amount_received, payment.data.currency)}`
                    : ""}
                  {Number(payment.data.outstanding_amount) > 0
                    ? ` · ${t("shopping.outstanding")} ${formatPrice(payment.data.outstanding_amount, payment.data.currency)}`
                    : ""}
                </Text>
              </View>
              {awaitingPayment ? (
                <View style={[styles.box, card]}>
                  <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>
                    {t("shopping.waitingForPayment")}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isPaying}
                    onPress={payNow}
                    style={[styles.action, { backgroundColor: theme.colors.primary, opacity: isPaying ? 0.6 : 1 }]}
                  >
                    {isPaying ? (
                      <ActivityIndicator color={theme.colors.onPrimary} />
                    ) : (
                      <Text style={{ color: theme.colors.onPrimary, fontWeight: "700" }}>{t("shopping.payNow")}</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
              {invoiceReady ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: "/(protected)/invoice/[id]", params: { id: String(o.id) } })}
                  style={[styles.action, { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={{ color: theme.colors.onPrimary, fontWeight: "700" }}>{t("shopping.viewInvoice")}</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {d ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setTracking((v) => !v)}
              style={[styles.action, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={{ color: theme.colors.onPrimary, fontWeight: "700" }}>
                {tracking ? t("shopping.hideTracking") : t("shopping.trackOrder")}
              </Text>
            </Pressable>
          ) : null}

          {d && tracking ? (
            <>
              <Text style={[styles.section, { color: theme.colors.text }]}>{t("shopping.delivery")}</Text>
              <View style={[styles.box, card]}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{t("shopping.deliveryCode")}</Text>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: "700" }} selectable>
                  {d.delivery_code}
                </Text>
                <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>
                  {t(`shopping.deliveryStatus.${d.status}`, { defaultValue: d.status })}
                </Text>
                {d.driver_name ? <Text style={{ color: theme.colors.textSecondary }}>{d.driver_name}</Text> : null}
                {d.vehicle_number ? <Text style={{ color: theme.colors.textSecondary }}>{d.vehicle_number}</Text> : null}
                {d.dispatched_at ? (
                  <Text style={{ color: theme.colors.textSecondary }}>
                    {t("shopping.dispatchedOn")}: {new Date(d.dispatched_at).toLocaleString()}
                  </Text>
                ) : null}
                {d.pickup_eta ? (
                  <Text style={{ color: theme.colors.textSecondary }}>
                    {t("shopping.pickupEta")}: {new Date(d.pickup_eta).toLocaleString()}
                  </Text>
                ) : null}
                {d.delivery_eta ? (
                  <Text style={{ color: theme.colors.textSecondary }}>
                    {t("shopping.eta")}: {new Date(d.delivery_eta).toLocaleString()}
                  </Text>
                ) : null}
                {d.delivered_at ? (
                  <Text style={{ color: theme.colors.textSecondary }}>
                    {t("shopping.deliveredOn")}: {new Date(d.delivered_at).toLocaleString()}
                  </Text>
                ) : null}
                {d.status === "failed" ? (
                  <Text style={{ color: theme.colors.error }}>{t("shopping.deliveryFailedHint")}</Text>
                ) : null}
                {d.notes ? <Text style={{ color: theme.colors.textMuted }}>{d.notes}</Text> : null}
              </View>

              {showHandoffCode ? (
                <View style={[styles.box, card]}>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{t("shopping.handoffCode")}</Text>
                  {d.delivery_otp ? (
                    <>
                      <Text style={[styles.handoff, { color: theme.colors.text }]} selectable>
                        {d.delivery_otp}
                      </Text>
                      <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>
                        {t("shopping.handoffCodeHint")}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>
                      {t("shopping.handoffCodePending")}
                    </Text>
                  )}
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: 12, padding: 20, paddingTop: 4, paddingBottom: 32 },
  section: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  box: { borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 },
  step: { alignItems: "center", flexDirection: "row", gap: 12 },
  dot: { borderRadius: 6, height: 12, width: 12 },
  line: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  lineName: { flex: 1 },
  totalText: { fontSize: 16, fontWeight: "700" },
  handoff: { fontSize: 28, fontWeight: "800", letterSpacing: 6 },
  action: { alignItems: "center", borderRadius: 12, justifyContent: "center", minHeight: 48 },
});
