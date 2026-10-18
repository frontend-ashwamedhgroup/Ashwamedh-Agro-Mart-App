// Farmer-facing diagnosis result. Renders only the fields Crop_Doctor_AI.md
// allows: never product names, SKUs, doses, confidence percentages or internal
// review flags.
import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import {
  availableLanguages,
  initialLanguage,
  localizeDiagnosis,
} from "../../services/cropDoctor/localize";
import { toDialNumber } from "../../services/cropDoctor/validation";
import { LanguageToggle } from "./DiagnosisLanguage";
import type { Diagnosis, DiagnosisLanguage } from "../../services/cropDoctor/types";
import { useTheme } from "../../theme";
import { formatPrice } from "../../utils/money";

/**
 * The server sets `contact_phone` only when the farmer should call the shop
 * (unsure, no product, a rejected answer, or a price that could not be made).
 */
export function needsCall(diagnosis: Pick<Diagnosis, "outcome" | "contact_phone">): boolean {
  return diagnosis.outcome !== "healthy" && toDialNumber(diagnosis.contact_phone).length > 0;
}

/** A sure diagnosis still waiting for the farmer's Yes / No. */
export function awaitsConfirmation(
  diagnosis: Pick<Diagnosis, "outcome" | "confirmation_status">,
): boolean {
  return diagnosis.outcome === "sure" && diagnosis.confirmation_status === "pending";
}

/** i18n key suffix describing where a diagnosis stands, for lists and badges. */
export function diagnosisStatusKey(
  diagnosis: Pick<Diagnosis, "outcome" | "price_status" | "confirmation_status">,
): "confirmPending" | "priceReady" | "contactShop" | "healthy" {
  if (diagnosis.outcome === "healthy") return "healthy";
  if (diagnosis.outcome === "unsure" || diagnosis.outcome === "no_product") return "contactShop";
  if (awaitsConfirmation(diagnosis)) return "confirmPending";
  if (diagnosis.price_status === "ready") return "priceReady";
  return "contactShop";
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

/** The farmer's own crop photo, shown while it is still on this device. */
export function CropPhoto({ uri }: { uri: string }) {
  const { t } = useTranslation();
  return (
    <Image
      accessibilityLabel={t("cropDoctor.yourPhoto")}
      contentFit="cover"
      source={{ uri }}
      style={styles.photo}
    />
  );
}

function DiseaseCard({
  disease,
  language,
}: {
  disease: NonNullable<Diagnosis["disease"]>;
  /** Undefined follows the app language. */
  language?: DiagnosisLanguage;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation("translation", { lng: language });
  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };
  const list = (title: string, items: string[]) =>
    items.length > 0 ? (
      <View style={styles.condition}>
        <Text style={[styles.conditionName, { color: theme.colors.text }]}>{title}</Text>
        {items.map((line) => (
          <Text key={line} style={[styles.body, { color: theme.colors.textSecondary }]}>
            • {line}
          </Text>
        ))}
      </View>
    ) : null;

  return (
    <View style={[styles.box, card]}>
      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{t("cropDoctor.diseaseTitle")}</Text>
      <Text style={[styles.heading, { color: theme.colors.text }]}>{disease.name}</Text>
      {disease.severity_label ? (
        <Text style={[styles.confidence, { color: theme.colors.text }]}>
          {t("cropDoctor.severityLabel")}: {disease.severity_label}
        </Text>
      ) : null}
      {list(t("cropDoctor.diseaseSymptoms"), disease.symptoms)}
      {list(t("cropDoctor.diseaseCauses"), disease.causes)}
      {list(t("cropDoctor.diseasePrevention"), disease.preventive_measures)}
      {disease.recommended_treatment ? (
        <View style={styles.condition}>
          <Text style={[styles.conditionName, { color: theme.colors.text }]}>
            {t("cropDoctor.diseaseTreatment")}
          </Text>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
            {disease.recommended_treatment}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  diagnosis: Diagnosis;
  /** Local uri of the photo that was sent, when this device still has it. */
  photoUri?: string;
  /** Extra actions (refresh, offer) rendered inside the result, above the disclaimer. */
  children?: ReactNode;
};

export function DiagnosisResult({ diagnosis: source, photoUri, children }: Props) {
  const { theme } = useTheme();
  // The result opens in English; the farmer can switch.
  const [language, setLanguage] = useState<DiagnosisLanguage>(() => initialLanguage(source));
  const languages = availableLanguages(source);
  // Older records have English text only; their labels keep following the app language.
  const textLanguage = languages.length > 0 ? language : undefined;
  const { t } = useTranslation("translation", { lng: textLanguage });
  const diagnosis = localizeDiagnosis(source, language);
  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };
  const isSure = diagnosis.outcome === "sure";
  const conditions = diagnosis.likely_conditions.filter((c) => c.name);
  const showPrice = isSure && diagnosis.price_status === "ready" && diagnosis.price !== null;

  return (
    <View style={styles.wrap}>
      {languages.length > 1 ? (
        <LanguageToggle languages={languages} onChange={setLanguage} value={language} />
      ) : null}
      {photoUri ? <CropPhoto uri={photoUri} /> : null}
      {diagnosis.disease ? <DiseaseCard disease={diagnosis.disease} language={textLanguage} /> : null}
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

        {diagnosis.severity ? (
          <Text style={[styles.confidence, { color: theme.colors.text }]}>
            {t("cropDoctor.severityLabel")}:{" "}
            {t(`cropDoctor.severity.${diagnosis.severity}`, { defaultValue: diagnosis.severity })}
          </Text>
        ) : null}

        {diagnosis.observations.length > 0 ? (
          <View style={styles.condition}>
            <Text style={[styles.conditionName, { color: theme.colors.text }]}>
              {t("cropDoctor.observationsTitle")}
            </Text>
            {diagnosis.observations.map((line) => (
              <Text key={line} style={[styles.body, { color: theme.colors.textSecondary }]}>
                • {line}
              </Text>
            ))}
          </View>
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
        {/* The server disclaimer is English only; the Marathi copy is the same text. */}
        {textLanguage === "mr" ? t("cropDoctor.disclaimerFallback") : diagnosis.disclaimer || t("cropDoctor.disclaimerFallback")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  photo: { aspectRatio: 4 / 3, borderRadius: 14, width: "100%" },
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
