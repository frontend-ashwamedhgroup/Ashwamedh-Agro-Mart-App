import { StyleSheet, View } from "react-native";

import { Skeleton } from "./Skeleton";

type ProfileFieldsSkeletonProps = {
  label: string;
};

/** Placeholder for the label + value rows in the profile's personal info card. */
export function ProfileFieldsSkeleton({ label }: ProfileFieldsSkeletonProps) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={styles.fields}
    >
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.field}>
          <Skeleton height={12} radius={5} width="30%" />
          <Skeleton height={18} radius={6} width={row === 1 ? "50%" : "70%"} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 18 },
  field: { gap: 8 },
});
