// In-app camera for the crop photo. Replaces ImagePicker.launchCameraAsync, whose
// external camera activity can get the app killed on Android when it returns with
// a full-resolution photo. Flow: viewfinder -> shutter -> confirm / retake.
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PickedPhoto } from "../../services/cropDoctor/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called with the confirmed shot; the caller re-encodes it before use. */
  onCaptured: (photo: PickedPhoto) => void;
  onDenied: (canAskAgain: boolean) => void;
  onError: () => void;
};

type Flash = "off" | "on" | "auto";
const NEXT_FLASH: Record<Flash, Flash> = { off: "on", on: "auto", auto: "off" };

export function CameraCapture({ visible, ...session }: Props) {
  return (
    <Modal animationType="fade" onRequestClose={session.onClose} statusBarTranslucent visible={visible}>
      {/* Mounted only while open, so every opening starts from fresh state. */}
      {visible ? <CameraSession {...session} /> : null}
    </Modal>
  );
}

function CameraSession({ onClose, onCaptured, onDenied, onError }: Omit<Props, "visible">) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const mounted = useRef(true);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState<Flash>("off");
  const [pending, setPending] = useState<PickedPhoto | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (permission === null || permission.granted) return;
    let cancelled = false;
    console.log("[CropDoctor] camera permission requesting", { status: permission.status });
    void requestPermission().then((result) => {
      console.log("[CropDoctor] camera permission result", {
        granted: result.granted,
        canAskAgain: result.canAskAgain,
        cancelled,
      });
      if (cancelled || result.granted) return;
      onDenied(result.canAskAgain);
      onClose();
    });
    return () => {
      cancelled = true;
    };
    // Ask once, when the permission state first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission === null]);

  const capture = async () => {
    if (!cameraRef.current || !ready || capturing) {
      console.log("[CropDoctor] capture ignored", { hasRef: !!cameraRef.current, ready, capturing });
      return;
    }
    setCapturing(true);
    console.log("[CropDoctor] capture start", { flash });
    try {
      const shot = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        exif: false,
        base64: false,
      });
      console.log("[CropDoctor] capture done", {
        uri: shot.uri,
        w: shot.width,
        h: shot.height,
        stillMounted: mounted.current,
      });
      if (mounted.current) setPending({ uri: shot.uri, width: shot.width, height: shot.height });
    } catch (error) {
      console.error("[CropDoctor] capture failed", error);
      if (mounted.current) {
        onError();
        onClose();
      }
    } finally {
      if (mounted.current) setCapturing(false);
    }
  };

  const confirm = () => {
    if (!pending) return;
    const photo = pending;
    console.log("[CropDoctor] photo confirmed", { uri: photo.uri });
    setPending(null);
    onCaptured(photo);
    onClose();
  };

  const showCamera = permission?.granted === true;

  return (
    <View style={styles.container}>
      {pending ? (
        <>
          <Image contentFit="contain" source={{ uri: pending.uri }} style={StyleSheet.absoluteFill} />
          <View style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPending(null)}
              style={[styles.pill, styles.retake]}
            >
              <Text style={styles.pillText}>{t("cropDoctor.cameraRetake")}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={confirm} style={[styles.pill, styles.use]}>
              <Text style={styles.pillText}>{t("cropDoctor.cameraUsePhoto")}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          {showCamera ? (
            <CameraView
              ref={cameraRef}
              flash={flash}
              mode="picture"
              onCameraReady={() => {
                console.log("[CropDoctor] camera ready");
                setReady(true);
              }}
              onMountError={(event) => {
                console.error("[CropDoctor] camera mount error", event.message);
                onError();
                onClose();
              }}
              style={styles.flex}
            />
          ) : null}

          <Pressable
            accessibilityLabel={t("cropDoctor.cameraClose")}
            accessibilityRole="button"
            onPress={onClose}
            style={[styles.topButton, { left: 20, top: insets.top + 12 }]}
          >
            <Text style={styles.topText}>✕</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFlash((current) => NEXT_FLASH[current])}
            style={[styles.topButton, styles.flashButton, { right: 20, top: insets.top + 12 }]}
          >
            <Text style={styles.topText}>{`⚡ ${flash.toUpperCase()}`}</Text>
          </Pressable>

          <View style={[styles.shutterWrap, { paddingBottom: insets.bottom + 20 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready || capturing }}
              disabled={!ready || capturing}
              onPress={() => void capture()}
              style={[styles.shutter, (!ready || capturing) && styles.disabled]}
            >
              {capturing ? <ActivityIndicator color="#111111" /> : <View style={styles.shutterInner} />}
            </Pressable>
            <Text style={styles.hint}>
              {ready ? t("cropDoctor.cameraTapToCapture") : t("cropDoctor.cameraPreparing")}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { backgroundColor: "#000000", flex: 1 },
  topButton: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    width: 44,
  },
  flashButton: { borderRadius: 14, paddingHorizontal: 12, width: undefined },
  topText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  shutterWrap: { alignItems: "center", bottom: 0, left: 0, position: "absolute", right: 0 },
  shutter: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 38,
    borderWidth: 4,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  shutterInner: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDDDDD",
    borderRadius: 28,
    borderWidth: 2,
    height: 56,
    width: 56,
  },
  disabled: { opacity: 0.5 },
  hint: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "500", marginTop: 10 },
  actions: {
    bottom: 0,
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    left: 0,
    paddingHorizontal: 24,
    position: "absolute",
    right: 0,
  },
  pill: { alignItems: "center", borderRadius: 14, flex: 1, justifyContent: "center", minHeight: 52 },
  retake: { backgroundColor: "rgba(211,47,47,0.9)" },
  use: { backgroundColor: "#2E7D32" },
  pillText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
