// Checkout: pick a saved address and payment method, then place the order.
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { FarmerAddress } from "../../components/location/types";
import { ScreenHeader } from "../../components/shop/ScreenHeader";
import { LoadingView, MessageView } from "../../components/shop/StateViews";
import { useCart } from "../../context/CartContext";
import { useLocationFlow } from "../../context/LocationContext";
import { getApiErrorMessage } from "../../hooks/useFarmerAddresses";
import { useSingleFlight } from "../../hooks/useSingleFlight";
import { isConnectionError } from "../../services/api/errors";
import { checkoutCart, fetchCart } from "../../services/shop/api";
import { waitForPaid } from "../../services/shop/orders";
import { logPayment, PaymentCancelledError, payForOrder } from "../../services/shop/payments";
import type { PaymentMethod } from "../../services/shop/types";
import { useTheme } from "../../theme";
import { formatPrice } from "../../utils/money";

const PAYMENT_METHODS: PaymentMethod[] = ["ONLINE", "COD"];

function describeAddress(address: FarmerAddress): string {
  return [address.address_line1, address.village, address.city, address.district, address.state, address.postal_code]
    .filter(Boolean)
    .join(", ");
}

export default function CheckoutScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { cart, reset } = useCart();
  const { addresses, openMap } = useLocationFlow();
  const [pickedAddressId, setAddressId] = useState<FarmerAddress["id"] | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("ONLINE");
  const [note, setNote] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null);

  const singleFlight = useSingleFlight();
  const { addresses: list, isLoading, error: addressError, refresh } = addresses;
  // Until the farmer picks one, use the default (or first) saved address.
  const addressId =
    pickedAddressId ?? (list.find((a) => a.is_default) ?? list[0])?.id ?? null;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const items = cart?.items ?? [];

  const openOrder = (id: number) => {
    reset();
    router.replace({ pathname: "/(protected)/order/[id]", params: { id: String(id) } });
  };

  // Opens Razorpay for an order that already exists; on failure the farmer stays here to retry.
  const pay = async (id: number) => {
    logPayment("checkout page: starting payment", { orderId: id });
    try {
      await payForOrder(id, {
        title: t("shopping.appName"),
        description: t("shopping.orderNumber", { id }),
        color: theme.colors.primary,
      });
      // A verified signature is not a paid order; wait for the server to confirm it.
      const paid = await waitForPaid(id);
      logPayment("checkout page: payment verified", { orderId: id, paid });
      Alert.alert(
        paid ? t("shopping.paymentSuccess") : t("shopping.paymentPending"),
        paid ? t("shopping.paymentSuccessMessage", { id }) : t("shopping.paymentPendingMessage", { id }),
        [{ text: t("shopping.ok"), onPress: () => openOrder(id) }],
        { cancelable: false },
      );
    } catch (error: unknown) {
      const cancelled = error instanceof PaymentCancelledError;
      logPayment(cancelled ? "checkout page: payment cancelled" : "checkout page: payment failed", {
        orderId: id,
        message: error instanceof Error ? error.message : String(error),
      });
      Alert.alert(
        cancelled ? t("shopping.paymentCancelled") : t("shopping.paymentFailed"),
        cancelled ? t("shopping.paymentRetryHint", { id }) : getApiErrorMessage(error) || t("shopping.paymentRetryHint", { id }),
        [
          { text: t("shopping.viewOrder"), style: "cancel", onPress: () => openOrder(id) },
          { text: t("shopping.retryPayment"), onPress: () => void singleFlight(() => pay(id)) },
        ],
        { cancelable: false },
      );
    }
  };

  // After a dropped connection the order may or may not have been created. If
  // the server cart is now empty it was, so retrying would place a second order.
  const orderWasPlaced = async (): Promise<boolean> => {
    try {
      const serverCart = await fetchCart();
      return serverCart.items.length === 0;
    } catch {
      return false;
    }
  };

  const placeOrder = () =>
    singleFlight(async () => {
    if (addressId === null) return;
    setIsPlacing(true);
    try {
      // Order already created (earlier payment failed): only retry the payment.
      let id = placedOrderId;
      if (id === null) {
        logPayment("checkout page: placing order", { addressId, method });
        const { order } = await checkoutCart({
          address_id: addressId,
          payment_method: method,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        logPayment("checkout page: order created", { orderId: order.id, status: order.status });
        id = order.id;
        setPlacedOrderId(id);
      }

      if (method === "ONLINE") {
        await pay(id);
        return;
      }
      Alert.alert(
        t("shopping.orderPlaced"),
        t("shopping.orderPlacedMessage", { id }),
        [{ text: t("shopping.ok"), onPress: () => openOrder(id) }],
        { cancelable: false },
      );
    } catch (error: unknown) {
      logPayment("checkout page: place order failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      if (placedOrderId === null && isConnectionError(error) && (await orderWasPlaced())) {
        reset();
        Alert.alert(
          t("shopping.checkoutError"),
          t("network.orderMaybePlaced"),
          [
            {
              text: t("network.checkOrders"),
              onPress: () => router.replace("/(protected)/orders"),
            },
          ],
          { cancelable: false },
        );
        return;
      }
      Alert.alert(
        t("shopping.checkoutError"),
        getApiErrorMessage(error) || t("shopping.tryAgain"),
      );
    } finally {
      setIsPlacing(false);
    }
    });

  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t("shopping.checkout")} />
      {items.length === 0 ? (
        <MessageView title={t("shopping.cartEmpty")} actionLabel={t("shopping.startShopping")} onAction={() => router.back()} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.section, { color: theme.colors.text }]}>{t("shopping.deliveryAddress")}</Text>
            {isLoading && list.length === 0 ? (
              <LoadingView />
            ) : list.length === 0 && addressError !== null ? (
              <View style={[styles.box, card]}>
                <Text style={{ color: theme.colors.textSecondary }}>{addressError}</Text>
                <Pressable accessibilityRole="button" onPress={() => void refresh()}>
                  <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{t("shopping.retry")}</Text>
                </Pressable>
              </View>
            ) : list.length === 0 ? (
              <View style={[styles.box, card]}>
                <Text style={{ color: theme.colors.textSecondary }}>{t("shopping.noAddress")}</Text>
                <Pressable accessibilityRole="button" onPress={() => void openMap()}>
                  <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{t("shopping.addAddress")}</Text>
                </Pressable>
              </View>
            ) : (
              list.map((address) => {
                const selected = address.id === addressId;
                return (
                  <Pressable
                    key={String(address.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setAddressId(address.id)}
                    style={[styles.box, card, selected && { borderColor: theme.colors.primary, borderWidth: 2 }]}
                  >
                    <Text style={[styles.addrLabel, { color: theme.colors.text }]}>
                      {address.label || address.address_type}
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>{describeAddress(address)}</Text>
                  </Pressable>
                );
              })
            )}

            <Text style={[styles.section, { color: theme.colors.text }]}>{t("shopping.paymentMethod")}</Text>
            {PAYMENT_METHODS.map((option) => {
              const selected = option === method;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setMethod(option)}
                  style={[styles.box, card, selected && { borderColor: theme.colors.primary, borderWidth: 2 }]}
                >
                  <Text style={[styles.addrLabel, { color: theme.colors.text }]}>
                    {option === "ONLINE" ? t("shopping.payOnline") : t("shopping.payCod")}
                  </Text>
                </Pressable>
              );
            })}

            <Text style={[styles.section, { color: theme.colors.text }]}>{t("shopping.note")}</Text>
            <TextInput
              accessibilityLabel={t("shopping.note")}
              multiline
              onChangeText={setNote}
              placeholder={t("shopping.notePlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.noteInput, card, { color: theme.colors.text }]}
              value={note}
            />

            <Text style={[styles.section, { color: theme.colors.text }]}>{t("shopping.orderSummary")}</Text>
            <View style={[styles.box, card]}>
              {items.map((item) => (
                <View key={item.id} style={styles.summaryRow}>
                  <Text numberOfLines={1} style={[styles.summaryName, { color: theme.colors.textSecondary }]}>
                    {item.product_name} × {Number(item.quantity)}
                  </Text>
                  <Text style={{ color: theme.colors.text }}>{formatPrice(item.line_total, item.currency)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.bar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <View>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{t("shopping.total")}</Text>
              <Text style={[styles.total, { color: theme.colors.text }]}>
                {cart ? formatPrice(cart.total, cart.currency) : ""}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: addressId === null || isPlacing }}
              disabled={addressId === null || isPlacing}
              onPress={placeOrder}
              style={[styles.place, { backgroundColor: theme.colors.primary, opacity: addressId === null ? 0.4 : 1 }]}
            >
              {isPlacing ? (
                <ActivityIndicator color={theme.colors.onPrimary} />
              ) : (
                <Text style={[styles.placeText, { color: theme.colors.onPrimary }]}>{placedOrderId !== null && method === "ONLINE" ? t("shopping.payNow") : t("shopping.placeOrder")}</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: 12, padding: 20, paddingTop: 4, paddingBottom: 28 },
  section: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  box: { borderRadius: 14, borderWidth: 1, gap: 4, padding: 14 },
  addrLabel: { fontSize: 15, fontWeight: "600", textTransform: "capitalize" },
  noteInput: { borderRadius: 14, borderWidth: 1, fontSize: 15, minHeight: 80, padding: 14, textAlignVertical: "top" },
  summaryRow: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  summaryName: { flex: 1 },
  bar: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  total: { fontSize: 20, fontWeight: "800" },
  place: { alignItems: "center", borderRadius: 14, flex: 1, justifyContent: "center", maxWidth: 220, minHeight: 50 },
  placeText: { fontSize: 15, fontWeight: "700" },
});
