// Treatment checkout for an accepted offer: add the offer to the treatment cart
// (POST /farmer/cart/), then place the order (POST /farmer/orders/). Payment
// continues on the existing order screen, which already handles Razorpay.
import { router, useLocalSearchParams } from "expo-router";
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

import type { FarmerAddress } from "../../../components/location/types";
import { ScreenHeader } from "../../../components/shop/ScreenHeader";
import { ErrorView, LoadingView, MessageView } from "../../../components/shop/StateViews";
import { useLocationFlow } from "../../../context/LocationContext";
import { useAsync } from "../../../hooks/useAsync";
import { getApiErrorMessage } from "../../../hooks/useFarmerAddresses";
import { useSingleFlight } from "../../../hooks/useSingleFlight";
import { isConnectionError } from "../../../services/api/errors";
import {
  addOfferToTreatmentCart,
  fetchOfferForDiagnosis,
  placeTreatmentOrder,
} from "../../../services/cropDoctor/api";
import { useTheme } from "../../../theme";
import { formatPrice } from "../../../utils/money";

function describeAddress(address: FarmerAddress): string {
  return [address.address_line1, address.village, address.city, address.district, address.state, address.postal_code]
    .filter(Boolean)
    .join(", ");
}

export default function TreatmentCheckoutScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { diagnosisId, offerId } = useLocalSearchParams<{ diagnosisId: string; offerId: string }>();
  const { addresses, openMap } = useLocationFlow();
  const singleFlight = useSingleFlight();

  const offerState = useAsync(() => fetchOfferForDiagnosis(Number(diagnosisId)), [diagnosisId]);
  const offer = offerState.data?.id === Number(offerId) ? offerState.data : null;

  const [pickedAddressId, setAddressId] = useState<FarmerAddress["id"] | null>(null);
  const [note, setNote] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  // Remembered so a retry after a failed order does not add the offer to the cart again.
  const [inCart, setInCart] = useState(false);

  const { addresses: list, isLoading, error: addressError, refresh } = addresses;
  const addressId = pickedAddressId ?? (list.find((a) => a.is_default) ?? list[0])?.id ?? null;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openOrders = () => router.replace("/(protected)/orders");

  const placeOrder = () =>
    singleFlight(async () => {
      if (addressId === null || !offer || offer.status !== "accepted") return;
      setIsPlacing(true);
      try {
        if (!inCart) {
          await addOfferToTreatmentCart(offer.id);
          setInCart(true);
        }
        const orderId = await placeTreatmentOrder({
          address_id: addressId,
          ...(note.trim() ? { note: note.trim() } : {}),
        });
        Alert.alert(
          t("cropDoctor.orderPlaced"),
          t("cropDoctor.orderPlacedMessage"),
          [
            {
              text: t("shopping.ok"),
              onPress: () =>
                orderId !== null
                  ? router.replace({ pathname: "/(protected)/order/[id]", params: { id: String(orderId) } })
                  : openOrders(),
            },
          ],
          { cancelable: false },
        );
      } catch (error: unknown) {
        // After a dropped connection the order may exist. A converted offer
        // means it does, and retrying would try to order it twice.
        if (isConnectionError(error)) {
          const latest = await fetchOfferForDiagnosis(Number(diagnosisId)).catch(() => null);
          if (latest?.status === "converted") {
            Alert.alert(
              t("shopping.checkoutError"),
              t("network.orderMaybePlaced"),
              [{ text: t("network.checkOrders"), onPress: openOrders }],
              { cancelable: false },
            );
            return;
          }
        }
        Alert.alert(t("shopping.checkoutError"), getApiErrorMessage(error) || t("shopping.tryAgain"));
      } finally {
        setIsPlacing(false);
      }
    });

  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };
  const canPlace = addressId !== null && offer?.status === "accepted" && !isPlacing;

  const body = () => {
    if (offerState.isLoading && !offerState.data) return <LoadingView />;
    if (!offerState.data && offerState.error) {
      return <ErrorView message={offerState.error} onRetry={offerState.reload} />;
    }
    if (!offer || offer.status !== "accepted") {
      return (
        <MessageView
          title={t("cropDoctor.offerNotReady")}
          message={t("cropDoctor.offerNotReadyHint")}
          actionLabel={t("cropDoctor.backToResult")}
          onAction={() => router.back()}
        />
      );
    }
    return (
      <>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[styles.section, { color: theme.colors.text }]}>{t("cropDoctor.treatmentOrder")}</Text>
          <View style={[styles.box, card]}>
            <Text style={{ color: theme.colors.textSecondary }}>{t("cropDoctor.treatmentPrice")}</Text>
            <Text style={[styles.total, { color: theme.colors.text }]}>
              {formatPrice(offer.offer_price, offer.currency)}
            </Text>
          </View>

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
        </ScrollView>

        <View style={[styles.bar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPlace, busy: isPlacing }}
            disabled={!canPlace}
            onPress={() => void placeOrder()}
            style={[styles.place, { backgroundColor: theme.colors.primary, opacity: canPlace || isPlacing ? 1 : 0.4 }]}
          >
            {isPlacing ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <Text style={[styles.placeText, { color: theme.colors.onPrimary }]}>{t("shopping.placeOrder")}</Text>
            )}
          </Pressable>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t("shopping.checkout")} />
      {body()}
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
  total: { fontSize: 26, fontWeight: "800" },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingVertical: 12 },
  place: { alignItems: "center", borderRadius: 14, justifyContent: "center", minHeight: 50 },
  placeText: { fontSize: 15, fontWeight: "700" },
});
