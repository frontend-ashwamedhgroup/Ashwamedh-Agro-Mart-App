// Checkout: pick a saved address and payment method, then place the order.
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import {
  describePaymentFailure,
  logPayment,
  PaymentCancelledError,
  payForOrder,
} from "../../services/shop/payments";
import type { Cart, PaymentMethod } from "../../services/shop/types";
import type { OrderOutcome } from "./order-success";
import { useTheme } from "../../theme";
import { formatPrice } from "../../utils/money";

const PAYMENT_METHODS: PaymentMethod[] = ["ONLINE", "COD"];
// Shown but not selectable. Remove "COD" here to offer cash on delivery again.
const UNAVAILABLE_METHODS: ReadonlySet<PaymentMethod> = new Set(["COD"]);

function describeAddress(address: FarmerAddress): string {
  return [address.address_line1, address.village, address.city, address.district, address.state, address.postal_code]
    .filter(Boolean)
    .join(", ");
}

export default function CheckoutScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { cart, reset } = useCart();
  const { addresses, openMap, selection } = useLocationFlow();
  const [pickedAddressId, setAddressId] = useState<FarmerAddress["id"] | null>(null);
  // True while the full address list is open; otherwise only the chosen one shows.
  const [isChoosing, setIsChoosing] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("ONLINE");
  const [note, setNote] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  // Razorpay reported success and the server is verifying / confirming it.
  const [isConfirming, setIsConfirming] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null);
  // What was ordered. Checkout empties the server cart, so once the order
  // exists this (not the refreshed, empty cart) is what the screen shows.
  const [ordered, setOrdered] = useState<Pick<Cart, "items" | "total" | "currency"> | null>(null);
  const busy = isPlacing || isConfirming;

  const singleFlight = useSingleFlight();
  const { addresses: list, isLoading, error: addressError, refresh } = addresses;
  const findAddress = (id: FarmerAddress["id"] | null | undefined) =>
    id == null ? undefined : list.find((a) => String(a.id) === String(id));
  // The farmer's pick while it still exists, else the address chosen as the
  // browsing location (also a just-added one), else the default, else the first.
  const selectedAddress =
    findAddress(pickedAddressId) ??
    findAddress(selection?.address?.id) ??
    list.find((a) => a.is_default) ??
    list[0] ??
    null;
  const addressId = selectedAddress?.id ?? null;
  // The order already carries its address; only the payment can be retried.
  const addressLocked = placedOrderId !== null;
  const hasNoAddress = list.length === 0 && !isLoading && addressError === null;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chooseAddress = (id: FarmerAddress["id"]) => {
    setAddressId(id);
    setIsChoosing(false);
  };

  // Saving on the map returns here; the new address becomes the browsing
  // location, which selects it above once the farmer's old pick is cleared.
  const addAddress = () => {
    setAddressId(null);
    setIsChoosing(false);
    void openMap(undefined, { returnTo: "/(protected)/checkout" });
  };

  const summary = ordered ?? cart;
  const items = summary?.items ?? [];

  // Leaving mid-payment would hide the result; Android back waits until it's done.
  useEffect(() => {
    if (!busy) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [busy]);

  const openOrder = (id: number) => {
    reset();
    router.replace({ pathname: "/(protected)/order/[id]", params: { id: String(id) } });
  };

  // Replaces checkout, so back never returns to an already-ordered cart.
  const finish = (id: number, outcome: OrderOutcome, paymentId?: string) => {
    router.replace({
      pathname: "/(protected)/order-success",
      params: {
        id: String(id),
        outcome,
        ...(summary ? { total: summary.total, currency: summary.currency } : {}),
        ...(paymentId ? { paymentId } : {}),
      },
    });
  };

  // Opens Razorpay for an order that already exists; on failure the farmer stays here to retry.
  const pay = async (id: number) => {
    logPayment("checkout page: starting payment", { orderId: id });
    try {
      const paymentId = await payForOrder(id, {
        title: t("shopping.appName"),
        description: t("shopping.orderNumber", { id }),
        color: theme.colors.primary,
        onAuthorized: () => setIsConfirming(true),
      });
      // A verified signature is not a paid order; wait for the server to confirm it.
      const paid = await waitForPaid(id);
      logPayment("checkout page: payment verified", { orderId: id, paid });
      finish(id, paid ? "paid" : "pending", paymentId);
    } catch (error: unknown) {
      setIsConfirming(false);
      const cancelled = error instanceof PaymentCancelledError;
      logPayment(cancelled ? "checkout page: payment cancelled" : "checkout page: payment failed", {
        orderId: id,
        message: error instanceof Error ? error.message : String(error),
      });
      Alert.alert(
        cancelled ? t("shopping.paymentCancelled") : t("shopping.paymentFailed"),
        cancelled
          ? t("shopping.paymentRetryHint", { id })
          : `${describePaymentFailure(error)}\n\n${t("shopping.paymentRetryHint", { id })}`,
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
        if (cart) setOrdered({ items: cart.items, total: cart.total, currency: cart.currency });
        // The server cart is empty now; refresh so the cart badge clears.
        reset();
      }

      if (method === "ONLINE") {
        await pay(id);
        return;
      }
      finish(id, "cod");
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
      // The address may have been removed elsewhere; reload so a stale one drops out.
      if (placedOrderId === null) void refresh();
      Alert.alert(
        t("shopping.checkoutError"),
        getApiErrorMessage(error) || t("shopping.tryAgain"),
      );
    } finally {
      setIsPlacing(false);
    }
    });

  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };
  const link = { color: theme.colors.primary, fontWeight: "700" as const };

  const renderAddress = (address: FarmerAddress, selected: boolean, onPress?: () => void) => (
    <Pressable
      key={String(address.id)}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.box, styles.addrRow, card, selected && { borderColor: theme.colors.primary, borderWidth: 2 }]}
    >
      <View style={[styles.radio, { borderColor: selected ? theme.colors.primary : theme.colors.textMuted }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: theme.colors.primary }]} /> : null}
      </View>
      <View style={styles.addrText}>
        <View style={styles.addrTitleRow}>
          <Text numberOfLines={1} style={[styles.addrLabel, { color: theme.colors.text }]}>
            {address.label || t(`location.${address.address_type}`)}
          </Text>
          {address.is_default ? (
            <Text style={[styles.badge, { borderColor: theme.colors.border, color: theme.colors.textSecondary }]}>
              {t("shopping.defaultAddress")}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>{describeAddress(address)}</Text>
      </View>
    </Pressable>
  );

  const addressSection = () => {
    if (isLoading && list.length === 0) return <LoadingView />;
    if (list.length === 0 && addressError !== null) {
      return (
        <View style={[styles.box, card]}>
          <Text style={{ color: theme.colors.textSecondary }}>{addressError}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refresh()}>
            <Text style={link}>{t("shopping.retry")}</Text>
          </Pressable>
        </View>
      );
    }
    if (list.length === 0) {
      return (
        <View style={[styles.box, styles.emptyBox, card]}>
          <Text style={[styles.addrLabel, { color: theme.colors.text }]}>{t("shopping.noAddressTitle")}</Text>
          <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>{t("shopping.noAddressHint")}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={addAddress}
            style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          >
            <Text style={[styles.placeText, { color: theme.colors.onPrimary }]}>{t("shopping.addDeliveryAddress")}</Text>
          </Pressable>
        </View>
      );
    }
    if (isChoosing && !addressLocked) {
      return (
        <View accessibilityRole="radiogroup" style={styles.list}>
          {list.map((address) => {
            const selected = String(address.id) === String(addressId);
            return renderAddress(address, selected, () => chooseAddress(address.id));
          })}
          <Pressable
            accessibilityRole="button"
            onPress={addAddress}
            style={[styles.box, styles.addRow, card, { borderStyle: "dashed" }]}
          >
            <Text style={link}>+ {t("shopping.addNewAddress")}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <>
        {selectedAddress ? renderAddress(selectedAddress, true) : null}
        {addressLocked ? (
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{t("shopping.addressLocked")}</Text>
        ) : null}
      </>
    );
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      {/* No swipe-back while an order or payment is in progress. */}
      <Stack.Screen options={{ gestureEnabled: !busy }} />
      <ScreenHeader title={t("shopping.checkout")} />
      {items.length === 0 ? (
        <MessageView title={t("shopping.cartEmpty")} actionLabel={t("shopping.startShopping")} onAction={() => router.back()} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.sectionRow}>
              <Text style={[styles.section, { color: theme.colors.text }]}>
                {t("shopping.deliveryAddress")}
                {list.length > 1 ? ` (${list.length})` : ""}
              </Text>
              {list.length > 0 && !addressLocked ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setIsChoosing((open) => !open)}
                >
                  <Text style={[link, styles.sectionAction]}>
                    {isChoosing ? t("shopping.cancel") : t("shopping.changeAddress")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {addressSection()}

            <Text style={[styles.section, { color: theme.colors.text }]}>{t("shopping.paymentMethod")}</Text>
            {PAYMENT_METHODS.map((option) => {
              const selected = option === method;
              const unavailable = UNAVAILABLE_METHODS.has(option);
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: unavailable }}
                  disabled={unavailable}
                  onPress={() => setMethod(option)}
                  style={[
                    styles.box,
                    card,
                    selected && { borderColor: theme.colors.primary, borderWidth: 2 },
                    unavailable && styles.unavailable,
                  ]}
                >
                  <Text style={[styles.addrLabel, { color: theme.colors.text }]}>
                    {option === "ONLINE" ? t("shopping.payOnline") : t("shopping.payCod")}
                  </Text>
                  {unavailable ? (
                    <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{t("shopping.methodUnavailable")}</Text>
                  ) : null}
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
                {summary ? formatPrice(summary.total, summary.currency) : ""}
              </Text>
            </View>
            {hasNoAddress ? (
              // Without an address the order can't be placed; lead straight to adding one.
              <Pressable
                accessibilityRole="button"
                onPress={addAddress}
                style={[styles.place, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={[styles.placeText, { color: theme.colors.onPrimary }]}>{t("shopping.addDeliveryAddress")}</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: addressId === null || busy, busy }}
                disabled={addressId === null || busy}
                onPress={placeOrder}
                style={[styles.place, { backgroundColor: theme.colors.primary, opacity: addressId === null ? 0.4 : 1 }]}
              >
                {isPlacing ? (
                  <ActivityIndicator color={theme.colors.onPrimary} />
                ) : (
                  <Text style={[styles.placeText, { color: theme.colors.onPrimary }]}>{placedOrderId !== null && method === "ONLINE" ? t("shopping.payNow") : t("shopping.placeOrder")}</Text>
                )}
              </Pressable>
            )}
          </View>
        </>
      )}
      {isConfirming ? (
        // Covers the screen (header back button included) until the server answers.
        <View
          accessibilityLiveRegion="polite"
          accessibilityViewIsModal
          style={[styles.overlay, { backgroundColor: theme.colors.background }]}
        >
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={[styles.overlayTitle, { color: theme.colors.text }]}>{t("shopping.confirmingPayment")}</Text>
          <Text style={[styles.overlayHint, { color: theme.colors.textSecondary }]}>
            {t("shopping.confirmingPaymentHint")}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: 12, padding: 20, paddingTop: 4, paddingBottom: 28 },
  section: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  sectionRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionAction: { fontSize: 14, marginTop: 8 },
  box: { borderRadius: 14, borderWidth: 1, gap: 4, padding: 14 },
  list: { gap: 10 },
  addrRow: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  addrText: { flex: 1, gap: 4 },
  addrTitleRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  addrLabel: { flexShrink: 1, fontSize: 15, fontWeight: "600", textTransform: "capitalize" },
  radio: { alignItems: "center", borderRadius: 11, borderWidth: 2, height: 22, justifyContent: "center", marginTop: 1, width: 22 },
  radioDot: { borderRadius: 6, height: 12, width: 12 },
  badge: { borderRadius: 8, borderWidth: 1, fontSize: 11, fontWeight: "600", overflow: "hidden", paddingHorizontal: 6, paddingVertical: 1 },
  addRow: { alignItems: "center", justifyContent: "center", minHeight: 50 },
  emptyBox: { gap: 8 },
  addButton: { alignItems: "center", alignSelf: "flex-start", borderRadius: 12, justifyContent: "center", marginTop: 4, minHeight: 44, paddingHorizontal: 18 },
  hint: { fontSize: 12 },
  unavailable: { opacity: 0.5 },
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
  overlay: { ...StyleSheet.absoluteFill, alignItems: "center", gap: 12, justifyContent: "center", padding: 32 },
  overlayTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  overlayHint: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
