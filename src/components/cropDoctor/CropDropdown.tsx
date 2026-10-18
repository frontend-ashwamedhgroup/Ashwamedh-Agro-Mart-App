// Searchable crop dropdown. The list opens inline, under the field.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";

import type { Crop } from "../../services/cropDoctor/types";
import { useTheme } from "../../theme";

type Props = {
  crops: Crop[];
  value: number | null;
  onChange: (cropId: number) => void;
  hasError?: boolean;
};

const LIST_HEIGHT = 240;
const SEARCH_HEIGHT = 60;

export function CropDropdown({ crops, value, onChange }: Props) {
  const { theme, mode } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () => crops.map((crop) => ({ label: crop.name, value: crop.id })),
    [crops],
  );
  const { colors } = theme;

  return (
    // The open list overlaps the fields below, so this must stack above them.
    // While open, reserve its height in layout: Android ignores touches outside the
    // parent's bounds, which made the absolutely positioned list impossible to scroll.
    <View
      style={{
        zIndex: 1000,
        elevation: 1000,
        paddingBottom: open ? LIST_HEIGHT + SEARCH_HEIGHT + 8 : 0,
      }}
    >
      <DropDownPicker
        closeAfterSelecting
        dropDownContainerStyle={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 14,
          borderWidth: 1,
          overflow: "hidden",
        }}
        dropDownDirection="BOTTOM"
        items={items}
        labelStyle={{ color: colors.text, fontSize: 15, fontWeight: "normal" }}
        listItemContainerStyle={{
          height: 48,
          paddingHorizontal: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
        listItemLabelStyle={{ color: colors.text, fontSize: 16 }}
        listMode="SCROLLVIEW"
        maxHeight={LIST_HEIGHT}
        onSelectItem={(item) => {
          console.log("[CropDoctor] crop selected", { value: item.value, label: item.label });
          if (typeof item.value === "number") onChange(item.value);
        }}
        open={open}
        placeholder={t("cropDoctor.cropPlaceholder")}
        placeholderStyle={{ color: colors.textMuted }}
        scrollViewProps={{ nestedScrollEnabled: true, keyboardShouldPersistTaps: "handled" }}
        searchContainerStyle={{ borderBottomColor: colors.border, borderBottomWidth: 1, padding: 10 }}
        searchPlaceholder={t("cropDoctor.cropSearch")}
        searchPlaceholderTextColor={colors.textMuted}
        searchTextInputStyle={{ color: colors.text, borderColor: colors.border }}
        selectedItemLabelStyle={{ fontWeight: "700" }}
        setOpen={(next) => {
          setOpen((previous) => {
            const resolved = typeof next === "function" ? next(previous) : next;
            console.log("[CropDoctor] crop dropdown", { open: resolved, crops: crops.length });
            return resolved;
          });
        }}
        setValue={() => undefined}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 14,
          borderWidth: 1,
          minHeight: 52,
          paddingHorizontal: 14,
        }}
        theme={mode === "dark" ? "DARK" : "LIGHT"}
        translation={{ NOTHING_TO_SHOW: t("cropDoctor.cropNoMatch") }}
        value={value}
      />
    </View>
  );
}
