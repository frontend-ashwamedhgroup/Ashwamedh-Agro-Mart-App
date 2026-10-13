// Farmer-facing diagnosis result. Renders only the fields Crop_Doctor_AI.md
// allows: never product names, SKUs, doses, confidence percentages or internal
// review flags.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { toDialNumber } from "../../services/cropDoctor/validation";
import type { Diagnosis } from "../../services/cropDoctor/types";
import { useTheme } from "../../theme";
import { formatPrice } from "../../utils/money";

/** `unsure` and `no_product` send the farmer to the shop by phone. */
export function needsCall(diagnosis: Pick<Diagnosis, "outcome" | "contact_phone">): boolean {
  return (
    (diagnosis.outcome === "unsure" || diagnosis.outcome === "no_product") &&
    toDialNumber(diagnosis.contact_phone).length > 0
  );
}

/** i18n key suffix describing where a diagnosis stands, for lists and badges. */
export function diagnosisStatusKey(
  diagnosis: Pick<Diagnosis, "outcome" | "price_status">,
): "pricePreparing" | "priceReady" | "contactShop" | "healthy" | "result" {
  if (diagnosis.outcome === "healthy") return "healthy";
  if (diagnosis.outcome === "unsure" || diagnosis.outcome === "no_product") return "contactShop";
  if (diagnosis.price_status === "ready") return "priceReady";
  if (diagnosis.price_status === "preparing") return "pricePreparing";
  return "result";
}

export function CallShopButton({ phone }: { phone: string }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const number = toDialNumber(phone);

  const call = async () => {
    try {
      await Linking.openURL(`tel:${number}`);
    } catch {
      Alert.alert(t("cropDoctor.callFailedTitle"), t("cropDoctor.callFailed", { phone }));
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t("cropDoctor.callShop")} ${phone}`}
      onPress={() => void call()}
      style={[styles.callButton, { backgroundColor: theme.colors.primary }]}
    >
      <Text style={[styles.callText, { color: theme.colors.onPrimary }]}>
        {t("cropDoctor.callShop")} · {phone}
      </Text>
    </Pressable>
  );
}

type Props = {
  diagnosis: Diagnosis;
  /** Extra actions (refresh, offer) rendered inside the result, above the disclaimer. */
  children?: ReactNode;
};

export function DiagnosisResult({ diagnosis, children }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };
  const isSure = diagnosis.outcome === "sure";
  const conditions = diagnosis.likely_conditions.filter((c) => c.name);
  const showPrice = isSure && diagnosis.price_status === "ready" && diagnosis.price !== null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.box, card]}>
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
          {diagnosis.crop_name}
          {diagnosis.created_at ? ` · ${new Date(diagnosis.created_at).toLocaleDateString()}` : ""}
        </Text>

        {isSure ? (
          <>
            <Text style={[styles.heading, { color: theme.colors.text }]}>
              {t("cropDoctor.problemFound")}
            </Text>
            {diagnosis.summary ? (
              <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                {diagnosis.summary}
              </Text>
            ) : null}
            {conditions.map((condition) => (
              <View key={condition.name} style={styles.condition}>
                <Text style={[styles.conditionName, { color: theme.colors.text }]}>
                  {condition.name}
                </Text>
                {condition.evidence ? (
                  <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                    {condition.evidence}
                  </Text>
                ) : null}
              </View>
            ))}
            {diagnosis.confidence_label ? (
              <Text style={[styles.confidence, { color: theme.colors.text }]}>
                {diagnosis.confidence_label}
              </Text>
            ) : null}
          </>
        ) : null}

        {diagnosis.farmer_message ? (
          <Text style={[styles.message, { color: theme.colors.text }]}>
            {diagnosis.farmer_message}
          </Text>
        ) : null}

        {diagnosis.water_warning ? (
          <Text accessibilityRole="alert" style={{ color: theme.colors.warning, lineHeight: 20 }}>
            {diagnosis.water_warning}
          </Text>
        ) : null}
      </View>

      {isSure && diagnosis.price_status === "preparing" ? (
        <View style={[styles.box, card]}>
          <Text style={[styles.heading, { color: theme.colors.text }]}>
            {t("cropDoctor.pricePreparingTitle")}
          </Text>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
            {t("cropDoctor.pricePreparingBody")}
          </Text>
        </View>
      ) : null}

      {showPrice && diagnosis.price ? (
        <View style={[styles.box, card]}>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            {t("cropDoctor.treatmentPrice")}
          </Text>
          <Text style={[styles.price, { color: theme.colors.text }]}>
            {formatPrice(diagnosis.price.amount, diagnosis.price.currency)}
          </Text>
        </View>
      ) : null}

      {needsCall(diagnosis) ? <CallShopButton phone={diagnosis.contact_phone} /> : null}

      {children}

      <Text style={[styles.disclaimer, { color: theme.colors.textMuted }]}>
        {diagnosis.disclaimer || t("cropDoctor.disclaimerFallback")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  box: { borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 },
  meta: { fontSize: 12, fontWeight: "600" },
  heading: { fontSize: 16, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
  condition: { gap: 2 },
  conditionName: { fontSize: 15, fontWeight: "700" },
  confidence: { fontSize: 14, fontWeight: "600" },
  message: { fontSize: 15, lineHeight: 22 },
  price: { fontSize: 28, fontWeight: "800" },
  callButton: { alignItems: "center", borderRadius: 12, justifyContent: "center", minHeight: 50, paddingHorizontal: 16 },
  callText: { fontSize: 15, fontWeight: "700" },
  disclaimer: { fontSize: 12, lineHeight: 18 },
});
