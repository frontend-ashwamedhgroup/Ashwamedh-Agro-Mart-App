// Photo area of the diagnosis form: a drop zone while empty, a preview once a photo is chosen.
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PickedPhoto } from "../../services/cropDoctor/types";
import { useTheme } from "../../theme";

type Props = {
  photo: PickedPhoto | null;
  busy: boolean;
  hasError: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onRemove: () => void;
};

export function PhotoPicker({ photo, busy, hasError, onCamera, onGallery, onRemove }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };
  // Only the tapped option shows progress; the other one must not look disabled.
  const [tapped, setTapped] = useState<"camera" | "gallery" | null>(null);

  return (
    <View
      style={[
        styles.zone,
        photo
          ? styles.zoneFilled
          : { borderColor: hasError ? theme.colors.error : theme.colors.border },
      ]}
    >
      {photo ? null : (
        <Text style={[styles.title, { color: theme.colors.textMuted }]}>{t("cropDoctor.photoTitle")}</Text>
      )}

      {photo ? (
        <View key={photo.uri} style={styles.full}>
          <Image
            accessibilityLabel={t("cropDoctor.photoLabel")}
            contentFit="cover"
            source={{ uri: photo.uri }}
            style={[styles.preview, card]}
            transition={200}
          />
          <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
            <Text style={{ color: theme.colors.onPrimary, fontWeight: "700", fontSize: 12 }}>
              ✓ {t("cropDoctor.photoReady")}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={t("cropDoctor.removePhoto")}
            accessibilityRole="button"
            disabled={busy}
            hitSlop={8}
            onPress={onRemove}
            style={styles.remove}
          >
            <Ionicons color="#fff" name="close" size={20} />
          </Pressable>
        </View>
      ) : (
      <View style={styles.row}>
        {[
          { key: "camera" as const, icon: "camera-outline" as const, label: t("cropDoctor.captureImage"), onPress: onCamera },
          { key: "gallery" as const, icon: "image-outline" as const, label: t("cropDoctor.selectFromGallery"), onPress: onGallery },
        ].map((option) => (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            key={option.label}
            onPress={() => {
              setTapped(option.key);
              option.onPress();
            }}
            style={[styles.option, busy && tapped === option.key && styles.faded]}
          >
            <View style={[styles.circle, { borderColor: theme.colors.text }]}>
              <Ionicons color={theme.colors.text} name={option.icon} size={48} />
            </View>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      )}

      {photo ? null : (
        <Text style={[styles.note, { color: theme.colors.textMuted }]}>{t("cropDoctor.photoFormats")}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    alignItems: "center",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 2,
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  zoneFilled: { borderWidth: 0, gap: 0, overflow: "hidden", paddingHorizontal: 0, paddingVertical: 0 },
  full: { width: "100%" },
  title: { fontSize: 12, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" },
  preview: { aspectRatio: 4 / 3, borderRadius: 16, width: "100%" },
  remove: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    position: "absolute",
    right: 10,
    top: 10,
    width: 32,
  },
  badge: { borderRadius: 12, left: 10, paddingHorizontal: 10, paddingVertical: 4, position: "absolute", top: 10 },
  row: { flexDirection: "row", gap: 16, justifyContent: "space-around", width: "100%" },
  option: { alignItems: "center", flex: 1, gap: 10 },
  faded: { opacity: 0.4 },
  circle: {
    alignItems: "center",
    borderRadius: 48,
    borderWidth: 1.5,
    height: 96,
    justifyContent: "center",
    width: 96,
  },
  label: { fontSize: 13, textAlign: "center" },
  note: { fontSize: 12, textAlign: "center" },
});
