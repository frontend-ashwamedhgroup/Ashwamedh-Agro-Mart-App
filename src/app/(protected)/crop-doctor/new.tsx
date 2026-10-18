// New crop diagnosis: photo + short form. The photo is uploaded first, then the
// diagnosis is created with the returned image_id (Crop_Doctor_AI.md §2-3).
// Every failure keeps the form; only a rejected photo is cleared.
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { Field } from "../../../components/cropDoctor/FormParts";
import { PhotoPicker } from "../../../components/cropDoctor/PhotoPicker";
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
  DiagnosisRequest,
  PickedPhoto,
} from "../../../services/cropDoctor/types";
import {
  toDecimalString,
  validateForm,
  type FormFieldName,
} from "../../../services/cropDoctor/validation";
import { useTheme } from "../../../theme";


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
  const { t, i18n } = useTranslation();
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
          params: { id: String(diagnosis.id), photoUri: photo.uri },
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
            setErrors({
              // Marathi app language shows the server's Marathi text when it sent one.
              photo: i18n.language === "mr" && failure.messageMr ? failure.messageMr : failure.message,
            });
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
                  params: { id: String(existing.id), photoUri: photo.uri },
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

  // The notice sits above the submit button, so bring it into view when it appears.
  useEffect(() => {
    if (banner) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [banner]);

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
          <Field label={t("cropDoctor.photoLabel")} error={errors.photo}>
            <PhotoPicker
              busy={busy}
              hasError={!!errors.photo}
              onCamera={() =>
                Alert.alert(t("cropDoctor.captureTipsTitle"), t("cropDoctor.captureTipsBody"), [
                  {
                    text: t("cropDoctor.captureTipsContinue"),
                    onPress: () => {
                      console.log("[CropDoctor] camera opened");
                      setCameraOpen(true);
                    },
                  },
                ])
              }
              onGallery={() => void chooseFromLibrary()}
              onRemove={() => {
                setPhoto(null);
                setImageId(null);
              }}
              photo={photo}
            />
          </Field>

          <Field label={t("cropDoctor.cropLabel")} error={errors.crop}>
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
            error={errors.sowingDate}
          >
            <CalendarButton
              onPick={(date) => {
                setSowingDate(date);
                clearError("sowingDate");
              }}
              value={sowingDate}
            />
          </Field>

          <Field
            label={t("cropDoctor.areaLabel")}
            error={errors.areaAcres}
          >
            <TextInput
              accessibilityLabel={t("cropDoctor.areaLabel")}
              keyboardType="decimal-pad"
              onChangeText={(text) => {
                setArea(text);
                clearError("areaAcres");
              }}
              placeholder="1.0"
              placeholderTextColor={theme.colors.textMuted}
              style={input}
              value={area}
            />
          </Field>

          <Field
            label={t("cropDoctor.waterLabel")}
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

          {/* <Field
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
          </Field> */}

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

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => void submit()}
            style={[styles.submit, { backgroundColor: theme.colors.primary, opacity: busy ? 0.7 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <Ionicons
                color={theme.colors.onPrimary}
                name={banner ? "refresh" : "sparkles"}
                size={20}
              />
            )}
            <Text style={[styles.submitText, { color: theme.colors.onPrimary }]}>
              {banner && !busy ? t("shopping.retry") : submitLabel}
            </Text>
          </Pressable>
        </KeyboardAwareScrollView>
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
  input: { borderRadius: 12, borderWidth: 1, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  multiline: { minHeight: 96, paddingTop: 12, textAlignVertical: "top" },
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
