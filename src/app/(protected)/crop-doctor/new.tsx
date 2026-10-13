// New crop diagnosis: photo + short form. The photo is uploaded first, then the
// diagnosis is created with the returned image_id (Crop_Doctor_AI.md §2-3).
// Every failure keeps the form; only a rejected photo is cleared.
import { Image } from "expo-image";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarButton } from "../../../components/cropDoctor/CalendarButton";
import { CameraCapture } from "../../../components/cropDoctor/CameraCapture";
import { CropDropdown } from "../../../components/cropDoctor/CropDropdown";
import { Chip, Field } from "../../../components/cropDoctor/FormParts";
import { ScreenHeader } from "../../../components/shop/ScreenHeader";
import { SHOP_BRANCH_ID } from "../../../config/branch";
import { useAsync } from "../../../hooks/useAsync";
import { getApiErrorMessage } from "../../../hooks/useFarmerAddresses";
import { useSingleFlight } from "../../../hooks/useSingleFlight";
import {
  createDiagnosis,
  fetchCrops,
  fetchDiagnoses,
  uploadDiagnosisImage,
} from "../../../services/cropDoctor/api";
import { toFailure } from "../../../services/cropDoctor/failures";
import { pickFromLibrary, preparePhoto, type PhotoResult } from "../../../services/cropDoctor/photo";
import type {
  ApplicationMethod,
  DiagnosisRequest,
  PickedPhoto,
} from "../../../services/cropDoctor/types";
import {
  daysAgoDate,
  maskDate,
  SYMPTOMS_MAX,
  toDecimalString,
  validateForm,
  type FormFieldName,
} from "../../../services/cropDoctor/validation";
import { useTheme } from "../../../theme";

const METHODS: ApplicationMethod[] = ["spray", "soil_drench", "drip"];
const DATE_SHORTCUTS = [
  { key: "dateToday", days: 0 },
  { key: "dateWeek", days: 7 },
  { key: "dateMonth", days: 30 },
  { key: "dateTwoMonths", days: 60 },
] as const;

type FieldErrors = Partial<Record<FormFieldName, string>>;

/** Server field names -> form fields. Anything else becomes the general banner. */
const SERVER_FIELD: Record<string, FormFieldName> = {
  crop_id: "crop",
  image: "photo",
  image_id: "photo",
  sowing_date: "sowingDate",
  area_acres: "areaAcres",
  water_litres_per_acre: "waterLitresPerAcre",
  symptoms: "symptoms",
};

export default function NewDiagnosisScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const singleFlight = useSingleFlight();
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const crops = useAsync(fetchCrops, []);

  const [cropId, setCropId] = useState<number | null>(null);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Set once the current photo is uploaded, so a retry never uploads it twice.
  const [imageId, setImageId] = useState<number | null>(null);
  const [sowingDate, setSowingDate] = useState("");
  const [area, setArea] = useState("");
  const [water, setWater] = useState("");
  const [method, setMethod] = useState<ApplicationMethod | null>(null);
  const [symptoms, setSymptoms] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "picking" | "uploading" | "analysing">("idle");
  const busy = step !== "idle";

  const clearError = (field: FormFieldName) =>
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });

  const showDenied = (source: "camera" | "library", canAskAgain: boolean) =>
    Alert.alert(
      t("cropDoctor.permissionTitle"),
      t(source === "camera" ? "cropDoctor.cameraDenied" : "cropDoctor.libraryDenied"),
      canAskAgain
        ? [{ text: t("shopping.ok") }]
        : [
            { text: t("shopping.cancel"), style: "cancel" },
            { text: t("cropDoctor.openSettings"), onPress: () => void Linking.openSettings() },
          ],
    );

  const applyResult = (result: PhotoResult, source: "camera" | "library") => {
    console.log("[CropDoctor] photo result", {
      source,
      status: result.status,
      ...(result.status === "picked" ? { w: result.photo.width, h: result.photo.height } : {}),
    });
    switch (result.status) {
      case "picked":
        setPhoto(result.photo);
        setImageId(null);
        clearError("photo");
        setBanner(null);
        break;
      case "denied":
        showDenied(source, result.canAskAgain);
        break;
      case "tooLarge":
        setErrors((previous) => ({ ...previous, photo: t("cropDoctor.photoTooLarge") }));
        break;
      case "failed":
        setErrors((previous) => ({ ...previous, photo: t("cropDoctor.photoFailed") }));
        break;
      default:
        break;
    }
  };

  const chooseFromLibrary = async () => {
    if (busy) return;
    setStep("picking");
    try {
      applyResult(await pickFromLibrary(), "library");
    } finally {
      setStep("idle");
    }
  };

  // The camera modal hands back the raw shot; shrink it before it is used.
  const onCameraCaptured = async (shot: PickedPhoto) => {
    setStep("picking");
    try {
      applyResult(await preparePhoto(shot), "camera");
    } finally {
      setStep("idle");
    }
  };

  const pickDate = (daysAgo: number) => {
    setSowingDate(daysAgoDate(daysAgo));
    clearError("sowingDate");
  };

  const errorText = (code: string | undefined) => (code ? t(`cropDoctor.errors.${code}`) : undefined);

  const submit = () =>
    singleFlight(async () => {
      console.log("[CropDoctor] submit pressed", {
        hasPhoto: photo !== null,
        imageId,
        cropId,
        sowingDate,
        area,
        water,
        method,
        symptomsLength: symptoms.trim().length,
      });
      setBanner(null);
      const found = validateForm({
        cropId,
        hasPhoto: photo !== null,
        sowingDate,
        areaAcres: area,
        waterLitresPerAcre: water,
        symptoms,
      });
      if (Object.keys(found).length > 0) {
        console.warn("[CropDoctor] submit blocked by validation", found);
        const mapped: FieldErrors = {};
        for (const [field, code] of Object.entries(found)) {
          mapped[field as FormFieldName] = errorText(
            field === "crop" ? "cropRequired" : field === "photo" ? "photoRequired" : code,
          );
        }
        setErrors(mapped);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      if (cropId === null || photo === null) return;
      setErrors({});

      let uploadedId = imageId;
      try {
        if (uploadedId === null) {
          setStep("uploading");
          console.log("[CropDoctor] uploading photo", { uri: photo.uri });
          uploadedId = await uploadDiagnosisImage(photo);
          console.log("[CropDoctor] photo uploaded", { imageId: uploadedId });
          setImageId(uploadedId);
        } else {
          console.log("[CropDoctor] reusing earlier upload", { imageId: uploadedId });
        }

        setStep("analysing");
        const request: DiagnosisRequest = {
          image_id: uploadedId,
          branch_id: SHOP_BRANCH_ID,
          crop_id: cropId,
          sowing_date: sowingDate,
          area_acres: toDecimalString(area),
          water_litres_per_acre: toDecimalString(water),
          ...(method ? { application_method: method } : {}),
          ...(symptoms.trim() ? { symptoms: symptoms.trim() } : {}),
        };
        console.log("[CropDoctor] creating diagnosis", request);
        const diagnosis = await createDiagnosis(request);
        console.log("[CropDoctor] diagnosis created", {
          id: diagnosis.id,
          outcome: diagnosis.outcome,
          priceStatus: diagnosis.price_status,
        });
        router.replace({
          pathname: "/(protected)/crop-doctor/[id]",
          params: { id: String(diagnosis.id) },
        });
      } catch (error: unknown) {
        const failure = toFailure(error);
        console.error("[CropDoctor] submit failed", error, {
          step,
          imageId: uploadedId,
          failureKind: failure.kind,
          ...(failure.kind === "fields" ? { fields: failure.fields } : {}),
          ...(failure.kind === "photo" ? { photoMessage: failure.message } : {}),
        });
        switch (failure.kind) {
          case "photo":
            // Nothing was saved; keep all answers and ask for a new photo.
            setPhoto(null);
            setImageId(null);
            setErrors({ photo: failure.message });
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            break;
          case "fields": {
            const mapped: FieldErrors = {};
            const general: string[] = [];
            for (const [field, message] of Object.entries(failure.fields)) {
              const target = SERVER_FIELD[field];
              if (target) mapped[target] = message;
              else general.push(message);
            }
            if (mapped.photo) {
              // The upload is no longer usable (e.g. it is not this farmer's).
              setPhoto(null);
              setImageId(null);
            }
            setErrors(mapped);
            if (general.length > 0) setBanner(general[0]);
            scrollRef.current?.scrollTo({ y: 0, animated: true });
            break;
          }
          case "aiUnavailable":
            setBanner(t("cropDoctor.aiUnavailable"));
            break;
          case "rateLimited":
            setBanner(t("cropDoctor.rateLimited"));
            break;
          case "connection": {
            // A timeout may mean the diagnosis was created anyway. Look for one
            // made from this upload before offering a retry that would duplicate it.
            if (uploadedId !== null) {
              const existing = await fetchDiagnoses()
                .then((list) => list.find((d) => d.image_id === uploadedId))
                .catch((lookupError: unknown) => {
                  console.warn("[CropDoctor] duplicate-check lookup failed", lookupError);
                  return undefined;
                });
              console.log("[CropDoctor] duplicate check after connection error", {
                imageId: uploadedId,
                foundDiagnosisId: existing?.id ?? null,
              });
              if (existing) {
                router.replace({
                  pathname: "/(protected)/crop-doctor/[id]",
                  params: { id: String(existing.id) },
                });
                return;
              }
            }
            setBanner(getApiErrorMessage(error));
            break;
          }
          default:
            setBanner(getApiErrorMessage(error));
            break;
        }
      } finally {
        setStep("idle");
      }
    });

  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };
  const input = [styles.input, card, { color: theme.colors.text }];
  const submitLabel =
    step === "uploading"
      ? t("cropDoctor.uploading")
      : step === "analysing"
        ? t("cropDoctor.analysing")
        : t("cropDoctor.submit");

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t("cropDoctor.newTitle")} />
      <View style={styles.flex}>
        <KeyboardAwareScrollView
          bottomOffset={24}
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {banner ? (
            <View
              accessibilityRole="alert"
              style={[styles.banner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.error }]}
            >
              <Text style={{ color: theme.colors.text, lineHeight: 20 }}>{banner}</Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
                {t("cropDoctor.answersKept")}
              </Text>
            </View>
          ) : null}

          <Field label={t("cropDoctor.photoLabel")} required hint={t("cropDoctor.photoHint")} error={errors.photo}>
            {photo ? (
              <Image
                accessibilityLabel={t("cropDoctor.photoLabel")}
                contentFit="cover"
                source={{ uri: photo.uri }}
                style={[styles.preview, card]}
              />
            ) : null}
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  console.log("[CropDoctor] camera opened");
                  setCameraOpen(true);
                }}
                style={[styles.photoButton, { backgroundColor: theme.colors.primary, opacity: busy ? 0.5 : 1 }]}
              >
                <Text style={{ color: theme.colors.onPrimary, fontWeight: "700" }}>
                  {photo ? t("cropDoctor.retakePhoto") : t("cropDoctor.takePhoto")}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void chooseFromLibrary()}
                style={[styles.photoButton, card, { opacity: busy ? 0.5 : 1 }]}
              >
                <Text style={{ color: theme.colors.text, fontWeight: "700" }}>
                  {t("cropDoctor.chooseGallery")}
                </Text>
              </Pressable>
            </View>
          </Field>

          <Field label={t("cropDoctor.cropLabel")} required error={errors.crop}>
            {crops.isLoading && !crops.data ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : !crops.data ? (
              <View style={[styles.box, card]}>
                <Text style={{ color: theme.colors.textSecondary }}>
                  {crops.error || t("cropDoctor.cropsLoadError")}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => void crops.reload()}>
                  <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{t("shopping.retry")}</Text>
                </Pressable>
              </View>
            ) : crops.data.length === 0 ? (
              <Text style={{ color: theme.colors.textSecondary }}>{t("cropDoctor.noCrops")}</Text>
            ) : (
              <CropDropdown
                crops={crops.data}
                hasError={!!errors.crop}
                onChange={(id) => {
                  setCropId(id);
                  clearError("crop");
                }}
                value={cropId}
              />
            )}
          </Field>

          <Field
            label={t("cropDoctor.sowingDateLabel")}
            required
            hint={t("cropDoctor.sowingDateHint")}
            error={errors.sowingDate}
          >
            <View style={styles.row}>
              <TextInput
                accessibilityLabel={t("cropDoctor.sowingDateLabel")}
                keyboardType="number-pad"
                maxLength={10}
                onChangeText={(text) => {
                  setSowingDate(maskDate(text));
                  clearError("sowingDate");
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.textMuted}
                style={[...input, styles.flex]}
                value={sowingDate}
              />
              <CalendarButton
                onPick={(date) => {
                  setSowingDate(date);
                  clearError("sowingDate");
                }}
                value={sowingDate}
              />
            </View>
            <View style={styles.chips}>
              {DATE_SHORTCUTS.map((shortcut) => (
                <Chip
                  key={shortcut.key}
                  label={t(`cropDoctor.${shortcut.key}`)}
                  selected={sowingDate === daysAgoDate(shortcut.days)}
                  onPress={() => pickDate(shortcut.days)}
                />
              ))}
            </View>
          </Field>

          <Field
            label={t("cropDoctor.areaLabel")}
            required
            hint={t("cropDoctor.areaHint")}
            error={errors.areaAcres}
          >
            <TextInput
              accessibilityLabel={t("cropDoctor.areaLabel")}
              keyboardType="decimal-pad"
              onChangeText={(text) => {
                setArea(text);
                clearError("areaAcres");
              }}
              placeholder="2.0"
              placeholderTextColor={theme.colors.textMuted}
              style={input}
              value={area}
            />
          </Field>

          <Field
            label={t("cropDoctor.waterLabel")}
            required
            hint={t("cropDoctor.waterHint")}
            error={errors.waterLitresPerAcre}
          >
            <TextInput
              accessibilityLabel={t("cropDoctor.waterLabel")}
              keyboardType="decimal-pad"
              onChangeText={(text) => {
                setWater(text);
                clearError("waterLitresPerAcre");
              }}
              placeholder="200"
              placeholderTextColor={theme.colors.textMuted}
              style={input}
              value={water}
            />
          </Field>

          <Field label={t("cropDoctor.methodLabel")} hint={t("cropDoctor.optional")}>
            <View style={styles.chips}>
              {METHODS.map((option) => (
                <Chip
                  key={option}
                  label={t(`cropDoctor.method.${option}`)}
                  selected={method === option}
                  // Tapping the chosen method again leaves it out of the request.
                  onPress={() => setMethod((current) => (current === option ? null : option))}
                />
              ))}
            </View>
          </Field>

          <Field
            label={t("cropDoctor.symptomsLabel")}
            hint={`${t("cropDoctor.symptomsHint")} (${symptoms.trim().length}/${SYMPTOMS_MAX})`}
            error={errors.symptoms}
          >
            <TextInput
              accessibilityLabel={t("cropDoctor.symptomsLabel")}
              maxLength={SYMPTOMS_MAX}
              multiline
              onChangeText={(text) => {
                setSymptoms(text);
                clearError("symptoms");
              }}
              placeholder={t("cropDoctor.symptomsPlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              style={[...input, styles.multiline]}
              value={symptoms}
            />
          </Field>
        </KeyboardAwareScrollView>

        <View style={[styles.bar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => void submit()}
            style={[styles.submit, { backgroundColor: theme.colors.primary, opacity: busy ? 0.7 : 1 }]}
          >
            {busy ? <ActivityIndicator color={theme.colors.onPrimary} /> : null}
            <Text style={[styles.submitText, { color: theme.colors.onPrimary }]}>
              {banner && !busy ? t("shopping.retry") : submitLabel}
            </Text>
          </Pressable>
        </View>
      </View>
      <CameraCapture
        onCaptured={(shot) => void onCameraCaptured(shot)}
        onClose={() => {
          console.log("[CropDoctor] camera closed");
          setCameraOpen(false);
        }}
        onDenied={(canAskAgain) => showDenied("camera", canAskAgain)}
        onError={() => setErrors((previous) => ({ ...previous, photo: t("cropDoctor.cameraFailed") }))}
        visible={cameraOpen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { gap: 18, padding: 20, paddingTop: 4, paddingBottom: 28 },
  banner: { borderRadius: 12, borderWidth: 1, gap: 4, padding: 12 },
  box: { borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 },
  row: { flexDirection: "row", gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preview: { aspectRatio: 4 / 3, borderRadius: 14, borderWidth: 1, width: "100%" },
  photoButton: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 8,
  },
  input: { borderRadius: 12, borderWidth: 1, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingVertical: 12 },
  submit: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 50,
  },
  submitText: { fontSize: 16, fontWeight: "700" },
});
