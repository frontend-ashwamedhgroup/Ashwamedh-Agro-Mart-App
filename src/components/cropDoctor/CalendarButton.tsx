// Opens a calendar to pick the sowing date. Android uses the native dialog; iOS
// shows an inline calendar in a bottom sheet. Future dates cannot be picked.
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatDate, parseDate } from "../../services/cropDoctor/validation";
import { useTheme } from "../../theme";

type Props = {
  /** Current value as YYYY-MM-DD, or anything else to start from today. */
  value: string;
  disabled?: boolean;
  onPick: (date: string) => void;
};

export function CalendarButton({ value, disabled, onPick }: Props) {
  const { theme, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());

  const start = () => {
    const parsed = parseDate(value);
    const today = new Date();
    // A typed future date would be rejected by the picker's maximum; clamp it.
    return parsed && parsed <= today ? parsed : today;
  };

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: start(),
        mode: "date",
        maximumDate: new Date(),
        onValueChange: (_event, selected) => onPick(formatDate(selected)),
      });
      return;
    }
    setDraft(start());
    setSheetOpen(true);
  };

  return (
    <>
      <Pressable
        accessibilityLabel={t("cropDoctor.sowingDateLabel")}
        accessibilityRole="button"
        disabled={disabled}
        onPress={open}
        style={[
          styles.button,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <Text style={{ color: value ? theme.colors.text : theme.colors.textMuted, fontSize: 15 }}>
          {value || "YYYY-MM-DD"}
        </Text>
        <Ionicons color={theme.colors.textMuted} name="calendar-outline" size={22} />
      </Pressable>

      {Platform.OS === "ios" ? (
        <Modal animationType="slide" onRequestClose={() => setSheetOpen(false)} transparent visible={sheetOpen}>
          <Pressable onPress={() => setSheetOpen(false)} style={styles.backdrop} />
          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 12 },
            ]}
          >
            <DateTimePicker
              accentColor={theme.colors.primary}
              display="inline"
              maximumDate={new Date()}
              mode="date"
              onValueChange={(_event, selected) => setDraft(selected)}
              themeVariant={mode === "dark" ? "dark" : "light"}
              value={draft}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onPick(formatDate(draft));
                setSheetOpen(false);
              }}
              style={[styles.done, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={{ color: theme.colors.onPrimary, fontWeight: "700", fontSize: 16 }}>
                {t("cropDoctor.dateDone")}
              </Text>
            </Pressable>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  backdrop: { backgroundColor: "rgba(0,0,0,0.4)", flex: 1 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  done: { alignItems: "center", borderRadius: 14, justifyContent: "center", minHeight: 50 },
});
