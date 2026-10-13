import { StyleSheet, View } from "react-native";

import { useTheme } from "../../theme";
import { Skeleton } from "./Skeleton";

type AddressListSkeletonProps = {
  label: string;
  rows?: number;
};

/** Placeholder rows matching the saved-address rows in the location sheet. */
export function AddressListSkeleton({
  label,
  rows = 2,
}: AddressListSkeletonProps) {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={styles.list}
    >
      {Array.from({ length: rows }, (_, row) => (
        <View
          key={row}
          style={[
            styles.row,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Skeleton height={40} radius={20} width={40} />
          <View style={styles.text}>
            <Skeleton height={15} radius={6} width="40%" />
            <Skeleton height={13} radius={6} width="85%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    padding: 14,
  },
  text: { flex: 1, gap: 8 },
});
