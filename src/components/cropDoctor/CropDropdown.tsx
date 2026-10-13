// Searchable crop dropdown. The list opens inline, under the field.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";

import type { Crop } from "../../services/cropDoctor/types";
import { useTheme } from "../../theme";

type Props = {
  crops: Crop[];
  value: number | null;
  onChange: (cropId: number) => void;
  hasError?: boolean;
};

export function CropDropdown({ crops, value, onChange, hasError }: Props) {
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
    <View style={{ zIndex: 1000, elevation: 1000 }}>
      <DropDownPicker
        closeAfterSelecting
        dropDownContainerStyle={{ backgroundColor: colors.surface, borderColor: colors.border }}
        dropDownDirection="BOTTOM"
        items={items}
        labelStyle={{ color: colors.text, fontSize: 15 }}
        listItemLabelStyle={{ color: colors.text, fontSize: 15 }}
        listMode="SCROLLVIEW"
        maxHeight={260}
        onSelectItem={(item) => {
          console.log("[CropDoctor] crop selected", { value: item.value, label: item.label });
          if (typeof item.value === "number") onChange(item.value);
        }}
        open={open}
        placeholder={t("cropDoctor.cropPlaceholder")}
        placeholderStyle={{ color: colors.textMuted }}
        scrollViewProps={{ nestedScrollEnabled: true, keyboardShouldPersistTaps: "handled" }}
        searchContainerStyle={{ borderBottomColor: colors.border }}
        searchPlaceholder={t("cropDoctor.cropSearch")}
        searchPlaceholderTextColor={colors.textMuted}
        searchTextInputStyle={{ color: colors.text, borderColor: colors.border }}
        searchable
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
          borderColor: hasError ? colors.error : colors.border,
          minHeight: 48,
        }}
        theme={mode === "dark" ? "DARK" : "LIGHT"}
        translation={{ NOTHING_TO_SHOW: t("cropDoctor.cropNoMatch") }}
        value={value}
      />
    </View>
  );
}
