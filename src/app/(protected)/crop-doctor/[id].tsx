// Diagnosis result with price refresh and the offer accept / reject step
// (Crop_Doctor_AI.md §4-5).
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

import { DiagnosisResult } from "../../../components/cropDoctor/DiagnosisResult";
import { ScreenHeader } from "../../../components/shop/ScreenHeader";
import { CardListSkeleton } from "../../../components/shop/Skeletons";
import { ErrorView, RefreshFailedNotice } from "../../../components/shop/StateViews";
import { useAsync } from "../../../hooks/useAsync";
import { getApiErrorMessage } from "../../../hooks/useFarmerAddresses";
import { useSingleFlight } from "../../../hooks/useSingleFlight";
import {
  acceptOffer,
  fetchDiagnosis,
  fetchOfferForDiagnosis,
  rejectOffer,
} from "../../../services/cropDoctor/api";
import type { Offer } from "../../../services/cropDoctor/types";
import { useTheme } from "../../../theme";
import { formatPrice } from "../../../utils/money";

// While the shop is preparing the price, look again now and then.
const PRICE_POLL_MS = 20_000;

export default function DiagnosisDetailScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const singleFlight = useSingleFlight();
  const [acting, setActing] = useState<"accept" | "reject" | null>(null);

  const diagnosis = useAsync(() => fetchDiagnosis(id), [id]);
  const d = diagnosis.data;
  const priceReady = d?.outcome === "sure" && d.price_status === "ready";
  const diagnosisId = d?.id ?? null;

  // The offer exists only once the price is ready.
  const offerState = useAsync(
    () => (priceReady && diagnosisId !== null ? fetchOfferForDiagnosis(diagnosisId) : Promise.resolve(null)),
    [priceReady, diagnosisId],
  );
  const offer: Offer | null = offerState.data;

  const preparing = d?.outcome === "sure" && d.price_status === "preparing";
  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(() => void diagnosis.reload(), PRICE_POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparing]);

  const refresh = () => Promise.all([diagnosis.reload(), offerState.reload()]);
  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };

  const act = (kind: "accept" | "reject") =>
    singleFlight(async () => {
      if (!offer) return;
      setActing(kind);
      try {
        await (kind === "accept" ? acceptOffer(offer.id) : rejectOffer(offer.id));
      } catch (error: unknown) {
        Alert.alert(t("cropDoctor.offerError"), getApiErrorMessage(error) || t("shopping.tryAgain"));
      } finally {
        // The response shape is undocumented, so always show the server's current state.
        await offerState.reload();
        setActing(null);
      }
    });

  const confirmReject = () =>
    Alert.alert(t("cropDoctor.rejectTitle"), t("cropDoctor.rejectMessage"), [
      { text: t("shopping.cancel"), style: "cancel" },
      { text: t("cropDoctor.reject"), style: "destructive", onPress: () => void act("reject") },
    ]);

  const openCheckout = () => {
    if (!offer || !d) return;
    router.push({
      pathname: "/(protected)/crop-doctor/checkout",
      params: { diagnosisId: String(d.id), offerId: String(offer.id) },
    });
  };

  const actionButton = (
    label: string,
    onPress: () => void,
    options: { primary?: boolean; busy?: boolean; disabled?: boolean } = {},
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!options.disabled, busy: !!options.busy }}
      disabled={options.disabled}
      onPress={onPress}
      style={[
        styles.action,
        options.primary ? { backgroundColor: theme.colors.primary } : { ...card, borderWidth: 1 },
        { opacity: options.disabled ? 0.5 : 1 },
      ]}
    >
      {options.busy ? (
        <ActivityIndicator color={options.primary ? theme.colors.onPrimary : theme.colors.text} />
      ) : (
        <Text style={{ color: options.primary ? theme.colors.onPrimary : theme.colors.text, fontWeight: "700" }}>
          {label}
        </Text>
      )}
    </Pressable>
  );

  const renderOffer = () => {
    if (!priceReady) return null;
    if (offerState.isLoading && !offerState.data) return <ActivityIndicator color={theme.colors.primary} />;
    if (offerState.error && !offer) {
      return (
        <View style={[styles.box, card]}>
          <Text style={{ color: theme.colors.textSecondary }}>{offerState.error}</Text>
          {actionButton(t("shopping.retry"), () => void offerState.reload())}
        </View>
      );
    }
    if (!offer) {
      return (
        <View style={[styles.box, card]}>
          <Text style={{ color: theme.colors.textSecondary }}>{t("cropDoctor.offerMissing")}</Text>
          {actionButton(t("cropDoctor.refresh"), () => void offerState.reload())}
        </View>
      );
    }

    const busy = acting !== null;
    return (
      <View style={[styles.box, card]}>
        <Text style={[styles.heading, { color: theme.colors.text }]}>{t("cropDoctor.offerTitle")}</Text>
        <Text style={[styles.price, { color: theme.colors.text }]}>
          {formatPrice(offer.offer_price, offer.currency)}
        </Text>
        {offer.status === "offer_available" && offer.expires_at ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
            {t("cropDoctor.offerExpires", { date: new Date(offer.expires_at).toLocaleString() })}
          </Text>
        ) : null}
        <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>
          {t(`cropDoctor.offerStatus.${offer.status}`)}
        </Text>

        {offer.status === "offer_available" ? (
          <View style={styles.row}>
            {actionButton(t("cropDoctor.reject"), confirmReject, {
              busy: acting === "reject",
              disabled: busy,
            })}
            {actionButton(t("cropDoctor.accept"), () => void act("accept"), {
              primary: true,
              busy: acting === "accept",
              disabled: busy,
            })}
          </View>
        ) : null}
        {offer.status === "accepted"
          ? actionButton(t("cropDoctor.continueToOrder"), openCheckout, { primary: true })
          : null}
        {offer.status === "pending" ? actionButton(t("cropDoctor.refresh"), () => void refresh()) : null}
      </View>
    );
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t("cropDoctor.resultTitle")} />
      {diagnosis.isLoading && !d ? (
        <CardListSkeleton count={3} />
      ) : !d ? (
        <ErrorView message={diagnosis.error} onRetry={diagnosis.reload} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl onRefresh={refresh} refreshing={diagnosis.isLoading} />}
          showsVerticalScrollIndicator={false}
        >
          <RefreshFailedNotice flush error={diagnosis.error} onRetry={refresh} />
          <DiagnosisResult diagnosis={d}>
            {preparing
              ? actionButton(t("cropDoctor.refreshPrice"), () => void diagnosis.reload(), {
                  busy: diagnosis.isLoading,
                  disabled: diagnosis.isLoading,
                })
              : null}
            {renderOffer()}
          </DiagnosisResult>
          {actionButton(t("cropDoctor.checkAnother"), () =>
            router.replace("/(protected)/crop-doctor/new"),
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: 12, padding: 20, paddingTop: 4, paddingBottom: 32 },
  box: { borderRadius: 14, borderWidth: 1, gap: 10, padding: 14 },
  row: { flexDirection: "row", gap: 10 },
  heading: { fontSize: 16, fontWeight: "700" },
  price: { fontSize: 28, fontWeight: "800" },
  action: { alignItems: "center", borderRadius: 12, flexGrow: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: 12 },
});
